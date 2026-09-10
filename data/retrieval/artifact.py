# -*- coding: utf-8 -*-
"""번들 로더 (spec 10 T1).

`serving/CURRENT.json` 이 가리키는 번들 하나를 읽어 좌표·메타·kNN 그래프·후처리 규칙을
행 인덱스 하나로 정렬된 상태로 들고 있는다.

정렬 규약 (검증됨, 2026-09-10):
    coords_v2.parquet 의 행 == catalog_v2.parquet 에서 excluded == False 인 행, **순서까지 동일**.
    kNN 그래프(`work/knn_graph/`)의 행 순서도 coords 기준(meta.json 의 mbid_order).
    따라서 정수 인덱스 i 하나가 좌표·메타·그래프를 모두 가리킨다.

메모리 (AC5: 상주 ≤ 3GB, app-node 목표 2GB):
    문자열을 파이썬 객체로 들면 5.71GB 가 나왔다(2026-09-10 측정). 그래서 `columns` 모듈의
    사전 인코딩을 쓴다. 비교만 하는 canonical 은 코드만, 화면에 나가는 artist/title 은
    코드 + 유일값 사전, mbid 는 uint64 두 개로 든다. `Bundle.memory_report()` 로 확인한다.

규칙 9: 후처리 임계값은 postprocess_rules.json 에서만 읽는다. 여기서 하드코딩하지 않는다.
"""
import gc
import io
import json
import os

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from . import columns

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 사전을 버리는 컬럼: 같은지만 보고 화면에 내보내지 않는다.
COMPARE_ONLY = ("canonical",)
# 사전을 남기는 문자열 컬럼: 응답에 실린다.
DISPLAY_STRINGS = ("artist_raw", "title_raw", "leaf_id", "node_d2")
# 숫자 컬럼과 목표 dtype.
NUMERIC = {"length": np.float32, "n_submissions": np.int32}
BOOLEAN = ("is_bridge", "is_korean", "excluded")
# v2.2 에서 추가되는 후순위 플래그. 없으면 조용히 건너뛴다.
OPTIONAL_FLAGS = ("flag_instrumental", "flag_long")


def _env_dir(name, default):
    return os.environ.get(name) or default


class Bundle(object):
    """로드된 서빙 번들 하나. 읽기 전용으로 다룬다."""

    def __init__(self, version, path, manifest, rules, coords, mbid, coded, numeric, boolean,
                 graph_indices, graph_meta, serve_mask):
        self.version = version
        self.path = path
        self.manifest = manifest
        self.rules = rules
        self.coords = coords                  # (N, 16) float32
        self.mbid = mbid                      # columns.MbidIndex
        self.coded = coded                    # dict[str, columns.CodedColumn]
        self.numeric = numeric                # dict[str, np.ndarray]
        self.boolean = boolean                # dict[str, np.ndarray(bool)]
        self.graph_indices = graph_indices    # (N, k) int32 memmap 또는 None
        self.graph_meta = graph_meta
        self.serve_mask = serve_mask          # (N,) bool — 이웃 후보로 쓸 수 있는 행

    @property
    def n(self):
        return self.coords.shape[0]

    @property
    def has_graph(self):
        return self.graph_indices is not None

    def row(self, mbid):
        """mbid -> 행 인덱스. 없으면 None."""
        return self.mbid.row(mbid)

    def song(self, row):
        """행 하나를 응답용 dict 로. 반환할 곡 수만큼만 부른다."""
        length = float(self.numeric["length"][row])
        return {
            "mbid": self.mbid.text(row),
            "title": self.coded["title_raw"].get(row),
            "artist": self.coded["artist_raw"].get(row),
            "length_s": length if np.isfinite(length) else None,
            "leaf_id": self.coded["leaf_id"].get(row),
            "node_d2": self.coded["node_d2"].get(row),
            "is_korean": bool(self.boolean["is_korean"][row]),
            "pc1": float(self.coords[row, 0]),
            "pc2": float(self.coords[row, 1]),
        }

    def memory_report(self):
        """상주 메모리 내역(바이트). AC5 확인용."""
        report = {"coords": self.coords.nbytes, "mbid": self.mbid.nbytes,
                  "serve_mask": self.serve_mask.nbytes}
        for name, col in self.coded.items():
            report["coded:" + name] = col.nbytes
        for name, arr in list(self.numeric.items()) + list(self.boolean.items()):
            report[name] = arr.nbytes
        report["total"] = sum(report.values())
        return report

    def health(self):
        return {
            "bundle": self.version,
            "songs": int(self.n),
            "servable": int(self.serve_mask.sum()),
            "graph": bool(self.has_graph),
            "graph_k": int(self.graph_indices.shape[1]) if self.has_graph else 0,
            "rules_version": self.rules.get("version"),
            "resident_bytes": self.memory_report()["total"],
        }


def _read_catalog(catalog_path, n_coords):
    """카탈로그를 읽어 excluded == False 행만 coords 순서로 남기고 압축 표현으로 바꾼다."""
    schema = pq.read_schema(catalog_path)
    wanted = ["mbid", "excluded"] + list(COMPARE_ONLY) + list(DISPLAY_STRINGS) \
        + list(NUMERIC) + [c for c in BOOLEAN if c != "excluded"] + list(OPTIONAL_FLAGS)
    table = pq.read_table(catalog_path, columns=[c for c in wanted if c in schema.names])

    excluded = table.column("excluded").to_numpy(zero_copy_only=False).astype(bool)
    keep = ~excluded
    if int(keep.sum()) != n_coords:
        raise ValueError(
            "카탈로그의 excluded=False 행 수 {} 가 coords 행 수 {} 와 다르다. "
            "번들과 카탈로그가 같은 버전인지 확인하라.".format(int(keep.sum()), n_coords))

    table = table.take(np.flatnonzero(keep))   # 한 번만 걸러내고 이후는 전부 정렬된 상태

    mbid = columns.MbidIndex.from_strings(table.column("mbid"))
    coded = {}
    for name in COMPARE_ONLY:
        if name in table.column_names:
            coded[name] = columns.encode(table.column(name), keep_values=False)
    for name in DISPLAY_STRINGS:
        if name in table.column_names:
            coded[name] = columns.encode(table.column(name), keep_values=True)

    numeric = {}
    for name, dtype in NUMERIC.items():
        if name in table.column_names:
            numeric[name] = table.column(name).to_numpy(zero_copy_only=False).astype(dtype)

    boolean = {}
    for name in list(BOOLEAN) + list(OPTIONAL_FLAGS):
        if name in table.column_names:
            boolean[name] = table.column(name).to_numpy(zero_copy_only=False).astype(bool)

    # 카탈로그 원본 테이블은 여기서 끝이다. arrow 가 잡아둔 버퍼까지 OS 로 돌려준다.
    # 안 하면 상주가 데이터 크기의 두 배 넘게 남는다(2026-09-10 측정: 2.34GB vs 847MB).
    del table
    gc.collect()
    pa.default_memory_pool().release_unused()
    return mbid, coded, numeric, boolean


def _load_graph(graph_dir, n):
    """kNN 그래프를 memmap 으로 연다. 없거나 좌표와 안 맞으면 쓰지 않는다."""
    idx_path = os.path.join(graph_dir, "indices.npy")
    meta_path = os.path.join(graph_dir, "meta.json")
    if not (os.path.exists(idx_path) and os.path.exists(meta_path)):
        return None, None
    gmeta = json.load(io.open(meta_path, encoding="utf-8"))
    if int(gmeta.get("n", -1)) != n:
        # 좌표가 바뀌면(major) 그래프를 재구축해야 한다. 불일치면 비활성.
        return None, {"disabled_reason": "n mismatch: graph {} vs coords {}".format(gmeta.get("n"), n)}
    indices = np.load(idx_path, mmap_mode="r")
    if indices.shape[0] != n:
        return None, {"disabled_reason": "indices shape {} vs coords {}".format(indices.shape, n)}
    return indices, gmeta


def build_serve_mask(numeric, coded, rules):
    """이웃 후보로 내보낼 수 있는 행 = 길이 규칙 통과 + 제목 있음.

    `excluded` 곡은 coords 에 애초에 없다(정렬 규약). 여기서 거르는 것은 둘뿐이다.
    임계값은 규칙 파일에서 읽는다(규칙 9).
    """
    lo = rules["length_range_s"]["min"]
    hi = rules["length_range_s"]["max"]
    length = numeric["length"].astype(np.float64)
    # 길이 결측은 규칙 위반으로 보지 않는다. postprocess 와 같은 판정.
    length_ok = ~np.isfinite(length) | ((length >= lo) & (length <= hi))
    has_title = coded["title_raw"].codes != columns.NULL
    return length_ok & has_title


def load(version=None, serving_dir=None, graph_dir=None, work_dir=None):
    """번들을 읽는다.

    version 을 주지 않으면 `serving/CURRENT.json` 의 포인터를 따른다.
    경로는 환경변수 ODY_SERVING_DIR / ODY_GRAPH_DIR / ODY_WORK 로 덮어쓸 수 있다.
    """
    serving_dir = serving_dir or _env_dir("ODY_SERVING_DIR", os.path.join(ROOT, "serving"))
    work_dir = work_dir or _env_dir("ODY_WORK", os.path.join(ROOT, "work"))
    graph_dir = graph_dir or _env_dir("ODY_GRAPH_DIR", os.path.join(work_dir, "knn_graph"))

    if version is None:
        current = json.load(io.open(os.path.join(serving_dir, "CURRENT.json"), encoding="utf-8"))
        version = current["bundle"]
    path = os.path.join(serving_dir, version)

    manifest = json.load(io.open(os.path.join(path, "manifest.json"), encoding="utf-8"))
    rules = json.load(io.open(os.path.join(path, "postprocess_rules.json"), encoding="utf-8"))

    k = int(manifest["k"])
    table = pq.read_table(os.path.join(path, "coords_v2.parquet"),
                          columns=["pc{}".format(i) for i in range(1, k + 1)])
    coords = np.empty((table.num_rows, k), dtype=np.float32)
    for j, name in enumerate(table.column_names):
        coords[:, j] = table.column(name).to_numpy(zero_copy_only=False)
    del table
    gc.collect()
    pa.default_memory_pool().release_unused()
    n = coords.shape[0]
    if n != int(manifest["songs"]):
        raise ValueError("coords 행 수 {} != manifest.songs {}".format(n, manifest["songs"]))

    catalog_path = os.path.join(work_dir, os.path.basename(manifest["catalog"]))
    mbid, coded, numeric, boolean = _read_catalog(catalog_path, n)
    graph_indices, graph_meta = _load_graph(graph_dir, n)
    serve_mask = build_serve_mask(numeric, coded, rules)

    return Bundle(version, path, manifest, rules, coords, mbid, coded, numeric, boolean,
                  graph_indices, graph_meta, serve_mask)
