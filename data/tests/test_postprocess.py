# -*- coding: utf-8 -*-
"""후처리 규칙 단위 테스트 (spec 10 T2).

합성 데이터라 번들 대용량 파일이 없어도 돈다. 임계값은 conftest 의 `rules` fixture 가
실제 `postprocess_rules.json` 에서 읽어온다(하드코딩 금지, 규칙 9).

`Meta` 는 문자열이 아니라 정수 코드를 받는다. 코드가 같으면 원문이 같다는 뜻이고
-1 은 값 없음이다(`retrieval.columns.NULL`).
"""
import numpy as np
import pytest

from retrieval.postprocess import NULL, Meta, apply_rules, low_similarity


def make_meta(n, canonical=None, artist=None, title=None, length=None, deprioritize=None):
    """행 0 을 쿼리로 쓰는 합성 메타. 기본값은 서로 겹치지 않는 곡들."""
    ident = np.arange(n, dtype=np.int32)
    return Meta(
        canonical=ident.copy() if canonical is None else np.array(canonical, dtype=np.int32),
        artist=ident.copy() if artist is None else np.array(artist, dtype=np.int32),
        title=ident.copy() if title is None else np.array(title, dtype=np.int32),
        length=np.array([200.0] * n if length is None else length, dtype=np.float32),
        deprioritize=None if deprioritize is None else np.array(deprioritize, dtype=bool),
    )


def far_dists(n, start=2.0, step=0.1):
    """tau_dup 보다 확실히 먼 거리들."""
    return np.array([start + step * i for i in range(n)], dtype=float)


def test_dup_fold_by_tau(rules):
    """쿼리와의 거리가 tau_dup 미만인 이웃은 같은 녹음으로 보고 접는다."""
    n = 13
    dist = np.concatenate([[rules["tau_dup"]["value"] - 0.1], far_dists(n - 2)])
    kept = apply_rules(np.arange(1, n), dist, 0, make_meta(n), rules, top_n=10)
    assert 1 not in kept
    assert len(kept) == 10


def test_artist_cap(rules):
    """같은 아티스트는 artist_cap 개를 넘지 못한다."""
    n = 20
    cap = rules["artist_cap"]["value"]
    artist = [0] + [999] * 8 + list(range(9, n))
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0, make_meta(n, artist=artist), rules, top_n=10)
    assert sum(1 for i in kept if artist[i] == 999) == cap


def test_length_rule(rules):
    """길이 규칙을 벗어난 곡은 후보에서 빠진다. 결측 길이는 통과시킨다."""
    n = 14
    lo, hi = rules["length_range_s"]["min"], rules["length_range_s"]["max"]
    length = [200.0] * n
    length[1] = lo - 1          # 너무 짧다
    length[2] = hi + 1          # 너무 길다
    length[3] = float("nan")    # 결측 — 거르지 않는다
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0, make_meta(n, length=length), rules, top_n=10)
    assert 1 not in kept and 2 not in kept
    assert 3 in kept


def test_same_canonical_as_query_dropped(rules):
    """쿼리와 같은 canonical 인 곡은 거리와 무관하게 빠진다."""
    n = 13
    canonical = [0, 0] + list(range(2, n))
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0, make_meta(n, canonical=canonical), rules, top_n=10)
    assert 1 not in kept


def test_same_recording_between_neighbors_folded(rules):
    """이웃끼리 같은 (아티스트, 제목) 이면 앞선 것만 남긴다."""
    n = 14
    artist = [0, 777, 777] + list(range(3, n))
    title = [0, 888, 888] + list(range(3, n))
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0,
                       make_meta(n, artist=artist, title=title), rules, top_n=10)
    assert 1 in kept and 2 not in kept


def test_missing_title_not_treated_as_match(rules):
    """제목 코드가 -1 인 곡끼리는 같은 곡으로 접지 않는다."""
    n = 14
    title = [0] + [NULL, NULL] + list(range(3, n))
    artist = [0] + [5, 5] + list(range(3, n))
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0,
                       make_meta(n, artist=artist, title=title), rules, top_n=10)
    assert 1 in kept and 2 in kept


def test_deprioritized_goes_last(rules):
    """후순위 플래그가 선 곡은 버리지 않고 뒤로 민다(규칙 2: 삭제 아님, 표시)."""
    n = 11                                # 후보 10개 = 슬롯 10개. 순서만 확인한다.
    depri = [False] * n
    depri[1] = True                       # 가장 가까운 이웃이지만 후순위
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0,
                       make_meta(n, deprioritize=depri), rules, top_n=10)
    assert 1 in kept, "후순위는 제외가 아니다"
    assert kept[-1] == 1, "후순위 곡은 마지막에 와야 한다"


def test_deprioritized_loses_slot_when_full(rules):
    """슬롯이 모자라면 후순위 곡이 먼저 밀려난다. 제외가 아니라 경쟁에서 진 것이다."""
    n = 12                                # 후보 11개, 슬롯 10개
    depri = [False] * n
    depri[1] = True
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0,
                       make_meta(n, deprioritize=depri), rules, top_n=10)
    assert len(kept) == 10 and 1 not in kept


def test_fewer_candidates_than_topn(rules):
    """후보가 모자라면 있는 만큼만 돌려준다. 예외를 던지지 않는다."""
    n = 4
    kept = apply_rules(np.arange(1, n), far_dists(n - 1), 0, make_meta(n), rules, top_n=10)
    assert len(kept) == 3


def test_query_row_never_returned(rules):
    """쿼리 자신은 후보에 들어와도 결과에 없다."""
    n = 13
    dist = np.concatenate([[0.0], far_dists(n - 2)])
    kept = apply_rules(np.arange(0, n - 1), dist, 0, make_meta(n), rules, top_n=10)
    assert 0 not in kept


@pytest.mark.parametrize("delta,expected", [(-0.01, False), (0.01, True)])
def test_low_similarity_threshold(rules, delta, expected):
    """10위 거리가 tau_far 를 넘으면 '유사도 낮음'."""
    assert low_similarity(rules["tau_far"]["value"] + delta, rules) is expected
