# -*- coding: utf-8 -*-
"""특징 선택 사슬 패리티 (spec 20 S1.5, Jira S15P21A405-119).

    원본 JSON 약 2,929  →  389  →  270

pyspark 없이 도는 부분만 여기서 검사한다. numpy 기준 구현(`feature_spec.extract_features`,
`korean_common.extract_270`)이 두 컷을 실제 원본 문서에 적용한 결과를 대조한다.
Spark 잡(`spark/jobs/feature_select.py`)은 같은 이름·순서를 쓰므로 이 검사가 그 잡의 계약이다.

원본 문서는 `data/intermediate/korean_ab_docs/` 에 표본이 있다. 없으면 skip 한다.
"""
import glob
import io
import json
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

N_STRUCTURAL = 389
N_KEPT = 270
N_DROPPED = 119


@pytest.fixture(scope="module")
def raw_docs():
    """실제 lowlevel JSON 표본. 없으면 skip."""
    paths = sorted(glob.glob(os.path.join(ROOT, "data", "intermediate", "korean_ab_docs", "*.json")))
    if not paths:
        pytest.skip("원본 JSON 표본 없음: data/intermediate/korean_ab_docs/")
    return [json.load(io.open(p, encoding="utf-8")) for p in paths]


def numeric_leaf_count(node):
    """문서 안 수치 잎 개수. 곡마다 다르다(beats_position 길이)."""
    if isinstance(node, dict):
        return sum(numeric_leaf_count(v) for v in node.values())
    if isinstance(node, list):
        return sum(numeric_leaf_count(v) for v in node)
    return 1 if isinstance(node, (int, float)) and not isinstance(node, bool) else 0


def test_raw_doc_has_thousands_of_leaves(raw_docs):
    """입력이 수천 개 규모임을 확인한다. 정확한 수는 곡마다 다르므로 범위로 본다."""
    counts = [numeric_leaf_count(d) for d in raw_docs]
    assert all(2000 < c < 5000 for c in counts), counts


def test_variable_length_series_is_why_count_varies(raw_docs):
    """개수가 흔들리는 원인이 beats_position 이라는 것을 명시한다.

    이 배열은 곡마다 길이가 달라 고정 차원 벡터로 못 만들고, 그래서 389 에서 제외된다.
    """
    lengths = [len(d["rhythm"]["beats_position"]) for d in raw_docs if "beats_position" in d["rhythm"]]
    if len(set(lengths)) <= 1:
        pytest.skip("표본이 모두 같은 길이라 변동을 보일 수 없다")
    assert len(set(lengths)) > 1, lengths


def test_structural_cut_gives_389(raw_docs):
    """S1.5a: 규칙만으로 389개가 나온다. 데이터를 보지 않는다."""
    from feature_spec import extract_features, FEATURE_NAMES
    for doc in raw_docs:
        values = extract_features(doc)
        assert len(values) == N_STRUCTURAL == len(FEATURE_NAMES)


def test_excluded_groups_are_absent_from_389():
    """cov·icov, 통계 6갈래, beats_position, metadata, 문자열이 389 에 없다."""
    from feature_spec import FEATURE_NAMES
    names = set(FEATURE_NAMES)
    assert not [n for n in names if ".cov" in n or ".icov" in n]
    for branch in ("median", "min", "max", "dmean.", "dvar", "dvar2"):
        assert not [n for n in names if n.endswith("." + branch.rstrip(".")) or ".{}".format(branch) in n], branch
    assert not [n for n in names if "beats_position" in n]
    assert not [n for n in names if n.startswith("metadata")]
    assert not [n for n in names if n.endswith("key_key") or n.endswith("chords_scale")]


def test_stability_cut_gives_270_and_is_subset(raw_docs):
    """S1.5b: 270 은 389 의 부분집합이고 119개가 빠진다."""
    from feature_spec import FEATURE_NAMES
    import korean_common as kc
    assert len(kc.KEPT) == N_KEPT
    assert set(kc.KEPT) <= set(FEATURE_NAMES)
    assert len(set(FEATURE_NAMES) - set(kc.KEPT)) == N_DROPPED


def test_chain_389_to_270_matches_direct_extraction(raw_docs):
    """핵심 패리티. 389 를 뽑아 270 을 골라낸 값이, 270 을 직접 뽑은 값과 같아야 한다.

    Spark 잡은 앞 경로(389 → select 270)를 쓰고 추출기는 뒤 경로(직접 270)를 쓴다.
    두 경로가 어긋나면 Spark 결과가 기존 아티팩트와 달라진다.
    """
    from feature_spec import extract_features, FEATURE_NAMES
    import korean_common as kc

    index_of = {name: i for i, name in enumerate(FEATURE_NAMES)}
    take = np.array([index_of[n] for n in kc.KEPT])

    for doc in raw_docs:
        via_389 = np.asarray(extract_features(doc), dtype=np.float64)[take]
        direct = np.asarray(kc.extract_270(doc), dtype=np.float64)
        assert via_389.shape == direct.shape == (N_KEPT,)
        both_nan = np.isnan(via_389) & np.isnan(direct)
        assert np.array_equal(np.isnan(via_389), np.isnan(direct)), "결측 위치가 다르다"
        finite = ~both_nan
        assert np.allclose(via_389[finite], direct[finite], rtol=0, atol=1e-12), \
            float(np.nanmax(np.abs(via_389[finite] - direct[finite])))


def test_kept_order_matches_pca_columns(bundle_dir):
    """270 순서가 PCA 행렬 열 순서다. 어긋나면 곱이 조용히 깨진다."""
    import korean_common as kc
    bundle = np.load(os.path.join(bundle_dir, "model_bundle.npz"))
    assert bundle["pca_components"].shape[1] == len(kc.KEPT)


def test_spark_job_imports_and_declares_same_counts():
    """Spark 잡이 pyspark 없이도 import 되고 같은 상수를 쓴다."""
    sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))
    import feature_select
    assert feature_select.N_STRUCTURAL == N_STRUCTURAL
    assert feature_select.N_KEPT == N_KEPT
