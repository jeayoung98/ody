# -*- coding: utf-8 -*-
"""후처리 규칙 단위 테스트 (scripts/postprocess_ab.apply_rules) — 10_retrieval_neighbors T2 의 씨앗."""
import io, json, os, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "scripts"))
from postprocess_ab import apply_rules  # noqa: E402

RULES = json.load(io.open(os.path.join(ROOT, "serving", "v2.1-pca16", "postprocess_rules.json"), encoding="utf-8"))


def _meta(n, canon=None, art=None, length=None):
    canon = np.array(canon if canon is not None else ["c{}".format(i) for i in range(n)], dtype=object)
    art = np.array(art if art is not None else ["a{}".format(i) for i in range(n)], dtype=object)
    tit = np.array(["t{}".format(i) for i in range(n)], dtype=object)
    length = np.array(length if length is not None else [200.0] * n, dtype=float)
    return (canon, art, tit, length, np.zeros(n, np.int32))


def test_dup_fold_by_tau():
    # 이웃 1 은 쿼리와 거리 0.5 (< τ_dup 1.66) → 접힘
    nbr = np.arange(1, 13); dist = np.array([0.5] + [2.0 + 0.1 * i for i in range(11)])
    kept = apply_rules(nbr, dist, 0, _meta(13), RULES)
    assert 1 not in kept and len(kept) == 10


def test_artist_cap():
    n = 20; art = ["same"] * 8 + ["a{}".format(i) for i in range(8, n)]
    nbr = np.arange(1, n); dist = 2.0 + 0.05 * np.arange(1, n)
    kept = apply_rules(nbr, dist, 0, _meta(n, art=art), RULES)
    assert sum(1 for i in kept if art[i] == "same") <= RULES["artist_cap"]["value"]


def test_length_rule():
    n = 15; length = [200.0] * n; length[3] = 10.0; length[4] = 5000.0
    nbr = np.arange(1, n); dist = 2.0 + 0.05 * np.arange(1, n)
    kept = apply_rules(nbr, dist, 0, _meta(n, length=length), RULES)
    assert 3 not in kept and 4 not in kept


def test_returns_at_most_10():
    n = 40; nbr = np.arange(1, n); dist = 2.0 + 0.02 * np.arange(1, n)
    assert len(apply_rules(nbr, dist, 0, _meta(n), RULES)) <= 10
