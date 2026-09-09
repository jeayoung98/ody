# -*- coding: utf-8 -*-
"""번들 로더 (spec 10 T1).

`serving/CURRENT.json` 이 가리키는 번들 하나를 읽어 좌표·카탈로그·kNN 그래프·후처리 규칙을
행 인덱스 하나로 정렬된 상태로 들고 있는다.

정렬 규약 (검증됨, 2026-09-10):
    coords_v2.parquet 의 행 == catalog_v2.parquet 에서 excluded == False 인 행, **순서까지 동일**.
    kNN 그래프(`work/knn_graph/`)의 행 순서도 coords 기준(meta.json 의 mbid_order).
    따라서 정수 인덱스 i 하나가 좌표·메타·그래프를 모두 가리킨다.

규칙 9: 후처리 임계값은 postprocess_rules.json 에서만 읽는다. 여기서 하드코딩하지 않는다.
규칙 4: 대용량 파일은 git 밖. 없으면 로드가 실패하는 대신 graph=None 등으로 축소 동작한다.
"""
import io
import json
import os

import numpy as np
import pyarrow.parquet as pq

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 서빙에 필요한 카탈로그 컬럼만 읽는다(7.4M 행 × 전체 컬럼은 메모리 낭비).
CATALOG_COLUMNS = [
    "mbid", "canonical", "artist_raw", "title_raw", "length",
    "n_submissions", "leaf_id", "node_d2", "is_bridge", "is_korean", "excluded",
]
# v2.2 에서 추가되는 후순위 플래그. 없으면 조용히 건너뛴다.
OPTIONAL_FLAG_COLUMNS = ["flag_instrumental", "flag_long"]


def _env_dir(name, default):
    return os.environ.get(name) or default


class Bundle:
    """로드된 서빙 번들 하나. 읽기 전용으로 다룬다."""

    def __init__(self, version, path, manifest, rules, coords, meta, graph_indices, graph_meta, serve_mask):
        self.version = version
        self.path = path
        self.manifest = manifest
        self.rules = rules
        self.coords = coords                  # (N, 16) float32, memmap 가능
        self.meta = meta                      # dict[str, np.ndarray], 길이 N
        self.graph_indices = graph_indices    # (N, k) int32 또는 None
        self.graph_meta = graph_meta          # dict 또는 None
        self.serve_mask = serve_mask          # (N,) bool — True 면 이웃 후보로 쓸 수 있다
        self._row_of = None                   # mbid -> row, 최초 조회 때 만든다

    # --- 기본 정보 -------------------------------------------------
    @property
    def n(self):
        return self.coords.shape[0]

    @property
    def has_graph(self):
        return self.graph_indices is not None

    def row(self, mbid):
        """mbid -> 행 인덱스. 없으면 None."""
        if self._row_of is None:
            self._row_of = {m: i for i, m in enumerate(self.meta["mbid"])}
        return self._row_of.get(mbid)

    def health(self):
        return {
            "bundle": self.version,
            "songs": int(self.n),
            "servable": int(self.serve_mask.sum()),
            "graph": bool(self.has_graph),
            "graph_k": int(self.graph_indices.shape[1]) if self.has_graph else 0,
            "rules_version": self.rules.get("version"),
        }


def _load_catalog_aligned(catalog_path, n_coords):
    """카탈로그를 읽어 excluded == False 행만 coords 순서로 남긴다."""
    schema = pq.read_schema(catalog_path)
    cols = [c for c in CATALOG_COLUMNS if c in schema.names]
    cols += [c for c in OPTIONAL_FLAG_COLUMNS if c in schema.names]
    table = pq.read_table(catalog_path, columns=cols)

    excluded = table.column("excluded").to_numpy(zero_copy_only=False).astype(bool)
    keep = ~excluded
    if int(keep.sum()) != n_coords:
        raise ValueError(
            "카탈로그의 excluded=False 행 수 {} 가 coords 행 수 {} 와 다르다. "
            "번들과 카탈로그가 같은 버전인지 확인하라.".format(int(keep.sum()), n_coords)
        )

    meta = {}
    for name in table.column_names:
        arr = table.column(name).to_numpy(zero_copy_only=False)
        meta[name] = arr[keep]
    return meta


def _load_graph(graph_dir, n, coords_mbid_first):
    """kNN 그래프를 memmap 으로 연다. 없거나 좌표와 안 맞으면 None."""
    idx_path = os.path.join(graph_dir, "indices.npy")
    meta_path = os.path.join(graph_dir, "meta.json")
    if not (os.path.exists(idx_path) and os.path.exists(meta_path)):
        return None, None

    gmeta = json.load(io.open(meta_path, encoding="utf-8"))
    if int(gmeta.get("n", -1)) != n:
        # 좌표가 바뀌면(major) 그래프를 재구축해야 한다. 불일치면 쓰지 않는다.
        return None, {"disabled_reason": "n mismatch: graph {} vs coords {}".format(gmeta.get("n"), n)}

    indices = np.load(idx_path, mmap_mode="r")
    if indices.shape[0] != n:
        return None, {"disabled_reason": "indices shape {} vs coords {}".format(indices.shape, n)}
    return indices, gmeta


def build_serve_mask(meta, rules):
    """이웃 후보로 내보낼 수 있는 행 = 길이 규칙 통과 + 제목 있음.

    `excluded` 곡은 coords 에 애초에 없다(정렬 규약 참조). 여기서 거르는 것은
    길이 규칙과 제목 없음 두 가지다. 임계값은 규칙 파일에서 읽는다(규칙 9).
    """
    lo = rules["length_range_s"]["min"]
    hi = rules["length_range_s"]["max"]
    length = meta["length"].astype(np.float64)
    # 길이가 결측(NaN)인 곡은 규칙 위반으로 보지 않는다. postprocess 와 같은 판정.
    length_ok = ~np.isfinite(length) | ((length >= lo) & (length <= hi))
    title = meta.get("title_raw")
    has_title = np.array([bool(t) and str(t).strip() != "" for t in title], dtype=bool)
    return length_ok & has_title


def load(version=None, serving_dir=None, graph_dir=None, work_dir=None, mmap=True):
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
    coords = np.column_stack([table.column(c).to_numpy(zero_copy_only=False) for c in table.column_names])
    coords = np.ascontiguousarray(coords, dtype=np.float32)
    n = coords.shape[0]
    if n != int(manifest["songs"]):
        raise ValueError("coords 행 수 {} != manifest.songs {}".format(n, manifest["songs"]))

    catalog_path = os.path.join(work_dir, os.path.basename(manifest["catalog"]))
    meta = _load_catalog_aligned(catalog_path, n)
    graph_indices, graph_meta = _load_graph(graph_dir, n, meta["mbid"][0] if n else None)
    serve_mask = build_serve_mask(meta, rules)

    return Bundle(version, path, manifest, rules, coords, meta, graph_indices, graph_meta, serve_mask)
