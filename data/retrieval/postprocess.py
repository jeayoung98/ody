# -*- coding: utf-8 -*-
"""후처리 규칙 (spec 10 T2).

`scripts/postprocess_ab.apply_rules` 를 옮긴 것이다. 원본은 검증된 실험 코드이므로
판정 순서와 조건을 바꾸지 않았다. 달라진 것은 세 가지다.

1. 문자열 대신 **정수 코드**로 비교한다(`retrieval.columns`). 코드가 같으면 원문이 같으므로
   판정 결과는 동일하고, 6.6M 행을 파이썬 문자열로 들지 않아도 된다. 코드 -1 은 값 없음이다.
2. `flag_*` 후순위 — 규칙 파일의 `display_filter.enabled` 가 참일 때 flag 가 선 곡을
   동률에서 뒤로 보낸다. 곡을 버리지 않고 순서만 미룬다(규칙 2: 삭제 아님, 표시).
3. `top_n` 인자 — 원본은 10 고정이었다. 여정(spec 11)이 다른 개수를 쓰므로 뺐다.

임계값은 전부 `postprocess_rules.json` 에서 읽는다. 하드코딩 금지(규칙 9).
"""
import numpy as np

NULL = -1


class Meta(object):
    """후처리가 보는 곡 메타. 배열 길이는 모두 같고 인덱스는 번들 행 번호다.

    canonical / artist / title 은 정수 코드다. 원문이 아니다.
    """

    __slots__ = ("canonical", "artist", "title", "length", "hub_count", "deprioritize")

    def __init__(self, canonical, artist, title, length, hub_count=None, deprioritize=None):
        self.canonical = canonical
        self.artist = artist
        self.title = title
        self.length = length
        n = len(canonical)
        self.hub_count = np.zeros(n, dtype=np.int32) if hub_count is None else hub_count
        # 후순위 대상(v2.2 flag_instrumental·flag_long 등). 없으면 전부 False.
        self.deprioritize = np.zeros(n, dtype=bool) if deprioritize is None else deprioritize


def meta_from_bundle(bundle):
    """Bundle 의 압축 컬럼에서 Meta 를 만든다. 배열을 복사하지 않고 참조만 잡는다."""
    n = bundle.n
    depri = np.zeros(n, dtype=bool)
    if bundle.rules.get("display_filter", {}).get("enabled"):
        for col in ("flag_instrumental", "flag_long"):
            if col in bundle.boolean:
                depri |= bundle.boolean[col]
    return Meta(
        canonical=bundle.coded["canonical"].codes,
        artist=bundle.coded["artist_raw"].codes,
        title=bundle.coded["title_raw"].codes,
        length=bundle.numeric["length"],
        hub_count=bundle.numeric.get("n_submissions"),
        deprioritize=depri,
    )


def apply_rules(nbr, dist, query_row, meta, rules, top_n=10):
    """후보 이웃에 규칙을 적용해 상위 top_n 행 인덱스를 돌려준다.

    nbr       후보 행 인덱스 (거리 오름차순)
    dist      nbr 과 같은 길이의 쿼리-후보 거리
    query_row 쿼리 곡의 행 인덱스. 자기 자신·같은 녹음을 거르는 데 쓴다.
    """
    tau = rules["tau_dup"]["value"]
    cap = rules["artist_cap"]["value"]
    lo = rules["length_range_s"]["min"]
    hi = rules["length_range_s"]["max"]

    nbr = np.asarray(nbr)
    dist = np.asarray(dist, dtype=np.float64)
    order = np.arange(len(nbr))

    if rules.get("hub_penalty", {}).get("enabled"):
        expected = rules["hub_penalty"]["expected"]
        penalty = dist * (1.0 + np.log1p(meta.hub_count[nbr] / expected))
        order = np.argsort(penalty, kind="stable")
    elif meta.deprioritize.any():
        # 후순위 곡을 뒤로. stable 정렬이라 같은 그룹 안 거리 순서는 유지된다.
        order = np.argsort(meta.deprioritize[nbr].astype(np.int8), kind="stable")

    q_canonical = int(meta.canonical[query_row])
    q_artist = int(meta.artist[query_row])
    q_title = int(meta.title[query_row])

    kept, kept_canonical, kept_key, artist_count = [], set(), set(), {}
    for j in order:
        i = int(nbr[j])
        if i == query_row:
            continue
        length_i = meta.length[i]
        if np.isfinite(length_i) and not (lo <= length_i <= hi):
            continue
        if dist[j] < tau:                                    # 쿼리와 같은 녹음
            continue
        canonical_i = int(meta.canonical[i])
        artist_i = int(meta.artist[i])
        title_i = int(meta.title[i])
        has_title = title_i != NULL
        if canonical_i in kept_canonical or (has_title and (artist_i, title_i) in kept_key):
            continue                                         # 앞선 이웃과 같은 녹음/키
        if canonical_i == q_canonical or (has_title and title_i == q_title and artist_i == q_artist):
            continue
        if artist_i != NULL and artist_count.get(artist_i, 0) >= cap:
            continue
        kept.append(i)
        kept_canonical.add(canonical_i)
        if has_title:
            kept_key.add((artist_i, title_i))
        if artist_i != NULL:
            artist_count[artist_i] = artist_count.get(artist_i, 0) + 1
        if len(kept) == top_n:
            break
    return kept


def low_similarity(dist_of_last, rules):
    """마지막 이웃 거리가 tau_far 를 넘으면 '유사도 낮음'."""
    return bool(dist_of_last > rules["tau_far"]["value"])
