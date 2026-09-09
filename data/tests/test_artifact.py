# -*- coding: utf-8 -*-
"""번들 로더 테스트 (spec 10 T1).

대용량 파일이 필요하므로 번들이 없는 머신에서는 conftest 의 `bundle_dir` 가 skip 한다.
`ODY_WORK` 아래 카탈로그도 있어야 한다. 없으면 개별 테스트가 skip 된다.
"""
import os
import time

import numpy as np
import pytest

from retrieval import artifact, columns

MEMORY_BUDGET_BYTES = 3 * 2 ** 30      # AC5: 상주 ≤ 3GB
LOAD_BUDGET_SECONDS = 60               # AC5: 기동 ≤ 60s


@pytest.fixture(scope="module")
def bundle(bundle_dir):
    """번들을 한 번만 로드해 모듈 안에서 공유한다. 로드 시간도 함께 잰다."""
    catalog = os.path.join(artifact._env_dir("ODY_WORK", os.path.join(artifact.ROOT, "work")),
                           "catalog_v2.parquet")
    if not os.path.exists(catalog):
        pytest.skip("카탈로그 없음: " + catalog)
    started = time.time()
    b = artifact.load()
    b.load_seconds = time.time() - started
    return b


def test_loads_within_budget(bundle):
    assert bundle.load_seconds <= LOAD_BUDGET_SECONDS, "번들 로드 {:.1f}s".format(bundle.load_seconds)


def test_resident_memory_within_budget(bundle):
    """AC5: 상주 메모리 예산. 5.71GB 였던 것을 사전 인코딩으로 줄인 결과를 지킨다."""
    total = bundle.memory_report()["total"]
    assert total <= MEMORY_BUDGET_BYTES, "{:.2f} GB".format(total / 2 ** 30)


def test_row_count_matches_manifest(bundle):
    assert bundle.n == int(bundle.manifest["songs"])
    assert bundle.coords.shape[1] == int(bundle.manifest["k"])
    assert bundle.coords.dtype == np.float32


def test_columns_aligned(bundle):
    """모든 컬럼은 좌표와 같은 길이여야 인덱스를 공유할 수 있다."""
    assert len(bundle.mbid) == bundle.n
    for name, col in bundle.coded.items():
        assert len(col) == bundle.n, "{} 길이 {}".format(name, len(col))
    for name, arr in list(bundle.numeric.items()) + list(bundle.boolean.items()):
        assert len(arr) == bundle.n, "{} 길이 {}".format(name, len(arr))


def test_excluded_songs_are_absent(bundle):
    """제외 곡은 coords 에 애초에 없다. 로더가 excluded=False 만 남겼는지 확인한다."""
    assert not bundle.boolean["excluded"].any()


def test_serve_mask_matches_rules(bundle):
    """마스크에서 걸러지는 것은 길이 규칙 위반과 제목 없음 두 가지뿐이다."""
    rules = bundle.rules
    lo, hi = rules["length_range_s"]["min"], rules["length_range_s"]["max"]
    length = bundle.numeric["length"].astype(np.float64)
    violates = np.isfinite(length) & ((length < lo) | (length > hi))
    no_title = bundle.coded["title_raw"].codes == columns.NULL
    assert int((~bundle.serve_mask).sum()) == int((violates | no_title).sum())
    assert not bundle.serve_mask[violates].any()


def test_row_lookup_roundtrip(bundle):
    """mbid 문자열 -> 행 -> mbid 문자열 왕복."""
    for i in (0, bundle.n // 2, bundle.n - 1):
        text = bundle.mbid.text(i)
        assert len(text) == 36 and text == text.lower()
        assert bundle.row(text) == i
    assert bundle.row("00000000-0000-0000-0000-000000000000") is None
    assert bundle.row("형식이-아닌-문자열") is None


def test_song_payload(bundle):
    """응답용 dict 가 기대한 키를 갖고 좌표와 일치한다."""
    song = bundle.song(0)
    assert song["mbid"] == bundle.mbid.text(0)
    assert song["pc1"] == pytest.approx(float(bundle.coords[0, 0]))
    assert set(song) >= {"mbid", "title", "artist", "length_s", "leaf_id", "node_d2", "pc1", "pc2"}


def test_compare_only_column_has_no_dictionary(bundle):
    """canonical 은 비교 전용이라 사전을 들지 않는다(메모리 절약의 핵심)."""
    assert bundle.coded["canonical"].values is None
    assert bundle.coded["canonical"].get(0) is None


def test_graph_aligned_or_disabled(bundle):
    """그래프는 좌표와 행 수가 같을 때만 쓴다. 다르면 비활성이어야 한다."""
    if not bundle.has_graph:
        pytest.skip("kNN 그래프 없음 — 정확 kNN 폴백으로만 동작")
    assert bundle.graph_indices.shape[0] == bundle.n
    assert int(bundle.graph_meta["n"]) == bundle.n
    sample = np.asarray(bundle.graph_indices[: min(1000, bundle.n)])
    assert sample.min() >= 0 and sample.max() < bundle.n


def test_health_reports_bundle(bundle):
    h = bundle.health()
    assert h["bundle"] == bundle.version
    assert h["songs"] == bundle.n
    assert 0 < h["servable"] <= h["songs"]
    assert h["resident_bytes"] <= MEMORY_BUDGET_BYTES
