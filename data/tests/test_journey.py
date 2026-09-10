# -*- coding: utf-8 -*-
"""여정 테스트 (spec 11, S15P21A405-118).

합성 좌표로 돌아 번들 대용량 파일이 없어도 통과한다.
임계값은 conftest 의 `rules` fixture 가 실제 `postprocess_rules.json` 에서 읽는다.
"""
from types import SimpleNamespace

import numpy as np
import pytest

from retrieval import journey as J
from retrieval.postprocess import Meta


def make_bundle(rules, n=400, spread=1.0, seed=0):
    """A(행 0) 에서 B(행 n-1) 로 가는 2차원 곡 구름.

    x 축을 따라 고르게 놓고 y 로 흩뿌린다. 축 통로가 의미를 갖는 배치다.
    """
    rng = np.random.default_rng(seed)
    coords = np.zeros((n, 2), dtype=np.float32)
    coords[:, 0] = np.linspace(0.0, 40.0, n)
    coords[:, 1] = rng.normal(0.0, spread, n).astype(np.float32)
    coords[0] = [0.0, 0.0]
    coords[n - 1] = [40.0, 0.0]
    return SimpleNamespace(
        coords=coords,
        n=n,
        rules=rules,
        serve_mask=np.ones(n, dtype=bool),
        graph_indices=None,
        has_graph=False,
    )


def make_meta(n, artist=None, canonical=None):
    ident = np.arange(n, dtype=np.int32)
    return Meta(
        canonical=ident.copy() if canonical is None else np.asarray(canonical, dtype=np.int32),
        artist=ident.copy() if artist is None else np.asarray(artist, dtype=np.int32),
        title=ident.copy(),
        length=np.full(n, 200.0, dtype=np.float32),
    )


# --- 축 좌표계 -------------------------------------------------------------

def test_axis_frame_endpoints(rules):
    """진행도는 A 에서 0, B 에서 1. 축 위 곡은 이탈이 0."""
    b = make_bundle(rules, spread=0.0)
    p, r, length = J.axis_frame(b, 0, b.n - 1)
    assert p[0] == pytest.approx(0.0, abs=1e-5)
    assert p[b.n - 1] == pytest.approx(1.0, abs=1e-5)
    assert length == pytest.approx(40.0, abs=1e-4)
    assert float(np.abs(r).max()) == pytest.approx(0.0, abs=1e-4)


def test_axis_frame_off_axis_distance(rules):
    """축에서 옆으로 벗어난 만큼이 r 로 나온다."""
    b = make_bundle(rules, n=3, spread=0.0)
    b.coords[1] = [20.0, 3.0]
    _, r, _ = J.axis_frame(b, 0, 2)
    assert float(r[1]) == pytest.approx(3.0, abs=1e-4)


# --- 최근접 백엔드 ---------------------------------------------------------

def test_nearest_backends_agree(rules):
    """전곡 스캔과 후보 제한이 같은 답을 낸다(후보에 정답이 있을 때)."""
    b = make_bundle(rules)
    point = np.array([17.3, 0.2], dtype=np.float32)
    full_idx, full_dist = J.nearest_to_point(b, point, k=3)
    cand_idx, cand_dist = J.nearest_to_point(b, point, k=3, candidates=np.arange(b.n))
    assert list(full_idx) == list(cand_idx)
    assert full_dist == pytest.approx(cand_dist, abs=1e-5)


def test_nearest_respects_mask(rules):
    """마스크로 막은 곡은 안 나온다."""
    b = make_bundle(rules)
    point = b.coords[100].copy()
    mask = np.ones(b.n, dtype=bool)
    mask[100] = False
    idx, _ = J.nearest_to_point(b, point, k=1, candidate_mask=mask)
    assert int(idx[0]) != 100


# --- 여정 본체 -------------------------------------------------------------

@pytest.mark.parametrize("mode", ["axis", "linear"])
def test_journey_returns_path(rules, mode):
    """두 모드 모두 경로를 돌려준다. 끝점은 역에 포함되지 않는다."""
    b = make_bundle(rules)
    out = J.journey(b, 0, b.n - 1, n=10, mode=mode, meta=make_meta(b.n))
    assert out["reachable"] and out["mode"] == mode
    assert len(out["stations"]) == 10
    assert all(s["row"] not in (0, b.n - 1) for s in out["stations"])


@pytest.mark.parametrize("mode", ["axis", "linear"])
def test_progress_monotonic(rules, mode):
    """역의 진행도가 단조 증가한다 (AC2)."""
    b = make_bundle(rules)
    out = J.journey(b, 0, b.n - 1, n=10, mode=mode, meta=make_meta(b.n))
    progress = [s["progress"] for s in out["stations"]]
    assert progress == sorted(progress), progress
    assert 0.0 < progress[0] and progress[-1] < 1.0


def test_axis_beats_linear_when_songs_are_clumpy(rules):
    """곡이 뭉쳐 있고 축 위에 빈 구간이 있으면 축 통로가 더 짧게 잇는다.

    고르게 퍼진 구름에서는 두 방식이 비슷하다. 차이는 실제 지도처럼 밀도가
    들쭉날쭉할 때 난다. 직선 보간은 빈 구간의 보간 지점에서 멀리 있는 곡을 집지만,
    축 통로는 걸음 비용이 열 전체에 걸려 뭉친 곳을 따라간다.
    실제 번들 기준 비교는 AC4 이고 `bench_journey.py` 가 잰다.
    """
    rng = np.random.default_rng(11)
    clumps = np.concatenate([rng.normal(c, 0.6, 120) for c in np.linspace(2.0, 38.0, 9)])
    n = len(clumps) + 2
    coords = np.zeros((n, 2), dtype=np.float32)
    coords[1:-1, 0] = clumps
    coords[1:-1, 1] = rng.normal(0.0, 1.5, n - 2)
    coords[0] = [0.0, 0.0]
    coords[-1] = [40.0, 0.0]
    b = SimpleNamespace(coords=coords, n=n, rules=rules,
                        serve_mask=np.ones(n, dtype=bool),
                        graph_indices=None, has_graph=False)
    meta = make_meta(n)
    axis = J.journey(b, 0, n - 1, n=8, mode="axis", meta=meta)
    linear = J.journey(b, 0, n - 1, n=8, mode="linear", meta=meta)
    axis_max = max(s["dist_from_prev"] for s in axis["stations"])
    linear_max = max(s["dist_from_prev"] for s in linear["stations"])
    assert axis_max <= linear_max, (axis_max, linear_max)


def test_artist_cap_enforced(rules):
    """같은 아티스트가 상한을 넘지 않는다 (AC2)."""
    b = make_bundle(rules, n=600, seed=2)
    cap = rules["artist_cap"]["value"]
    artist = np.zeros(b.n, dtype=np.int32)          # 대부분 같은 아티스트
    artist[::7] = np.arange(len(artist[::7]), dtype=np.int32) + 1000
    out = J.journey(b, 0, b.n - 1, n=10, mode="axis", meta=make_meta(b.n, artist=artist))
    if out["reachable"]:
        counts = {}
        for s in out["stations"]:
            a = int(artist[s["row"]])
            counts[a] = counts.get(a, 0) + 1
        assert max(counts.values()) <= cap, counts


def test_no_duplicate_canonical(rules):
    """같은 canonical 이 두 번 나오지 않는다 (AC2)."""
    b = make_bundle(rules, n=600, seed=3)
    canonical = (np.arange(b.n) // 3).astype(np.int32)   # 셋씩 같은 녹음
    out = J.journey(b, 0, b.n - 1, n=10, mode="axis", meta=make_meta(b.n, canonical=canonical))
    if out["reachable"]:
        got = [int(canonical[s["row"]]) for s in out["stations"]]
        assert len(got) == len(set(got)), got


def test_far_journey_gets_more_stations(rules):
    """D3: 끝점이 멀면 역 수가 늘고 far 가 선다."""
    b = make_bundle(rules, n=800, seed=4)
    b.coords[:, 0] = np.linspace(0.0, 16.0, b.n)        # 끝점 거리 16 > 10.7
    b.coords[0] = [0.0, 0.0]
    b.coords[b.n - 1] = [16.0, 0.0]
    out = J.journey(b, 0, b.n - 1, mode="axis", meta=make_meta(b.n))
    assert out["far"] is True
    assert out["n_stations"] > 10


def test_near_journey_default_ten(rules):
    """가까운 끝점이면 역 10개, far 는 거짓."""
    b = make_bundle(rules, n=400, seed=5)
    b.coords[:, 0] = np.linspace(0.0, 8.0, b.n)
    b.coords[0] = [0.0, 0.0]
    b.coords[b.n - 1] = [8.0, 0.0]
    out = J.journey(b, 0, b.n - 1, mode="axis", meta=make_meta(b.n))
    assert out["far"] is False and out["n_stations"] == 10


def test_serve_mask_excluded_never_appears(rules):
    """제외된 곡은 역에 나오지 않는다 (AC2)."""
    b = make_bundle(rules, n=600, seed=6)
    b.serve_mask[200:300] = False
    out = J.journey(b, 0, b.n - 1, n=10, mode="axis", meta=make_meta(b.n))
    assert all(not (200 <= s["row"] < 300) for s in out["stations"])


def test_unknown_mode_raises(rules):
    b = make_bundle(rules)
    with pytest.raises(ValueError):
        J.journey(b, 0, b.n - 1, mode="없는모드", meta=make_meta(b.n))


def test_default_mode_is_axis():
    """D10: 기본 모드는 axis."""
    assert J.DEFAULT_MODE == "axis"
