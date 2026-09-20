# -*- coding: utf-8 -*-
"""특징 선택 사슬 검사 (spec 20 S1.5, Jira S15P21A405-119).

원본 JSON 수치 잎 약 2,900 → `feature_spec.COLUMNS` 389 → `feature_list.json` 270.
앞 단계는 규칙이라 Spark 가 재현하고, 뒤 단계는 fit 이라 적용만 한다(규칙 3).

이 파일이 지키는 것은 **두 목록이 서로 어긋나지 않는다**는 것이다.
번들 json 만 있으면 되므로 대용량 데이터 없이 돈다.
"""
import sys
import os

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

N_STRUCTURAL = 389      # feature_spec.COLUMNS
N_KEPT = 270            # feature_list.json
N_DROPPED = 119         # exp_a.py 의 S_cross < 2.0
PCA_K = 16


@pytest.fixture(scope="module")
def spec_columns():
    """구조 선택 결과. import 자체가 회귀 검사다 — 이 모듈이 data/ 에 없어서 깨진 적이 있다."""
    from feature_spec import COLUMNS, FEATURE_NAMES
    return COLUMNS, FEATURE_NAMES


@pytest.fixture(scope="module")
def feature_list(current, root):
    import io
    import json
    path = os.path.join(root, "serving", current["bundle"], "feature_list.json")
    return json.load(io.open(path, encoding="utf-8"))


def test_korean_common_imports(current, root):
    """참조 구현이 import 된다. feature_spec 누락으로 ModuleNotFoundError 가 났었다.

    ⚠️ korean_common 은 **import 시점에** model_bundle.npz 를 읽는다
    (scripts/korean_common.py:41 의 모듈 수준 np.load). 그 번들은 git 밖 대용량이라
    팀 clone 에는 없다 — 없으면 skip 한다. conftest 의 bundle_dir 과 같은 규칙이다.

    이 파일의 나머지 검사는 json 만 쓰므로 번들 없이도 그대로 돈다
    (위 모듈 docstring 의 "대용량 데이터 없이 돈다" 를 이 검사만 어기고 있었다).
    """
    npz = os.path.join(root, "serving", current["bundle"], "model_bundle.npz")
    if not os.path.exists(npz):
        pytest.skip("번들 대용량 파일 없음: " + npz)
    import korean_common
    assert len(korean_common.KEPT) == N_KEPT
    assert korean_common.CLIP == 20.0


def test_structural_selection_count(spec_columns):
    columns, names = spec_columns
    assert len(columns) == N_STRUCTURAL
    assert len(names) == N_STRUCTURAL
    assert len(set(names)) == N_STRUCTURAL, "구조 선택 목록에 중복이 있다"


def test_kept_count_and_subset(spec_columns, feature_list):
    """270 은 389 의 부분집합이어야 한다. 아니면 두 단계가 어긋난 것이다."""
    _, names = spec_columns
    kept = feature_list["features"]
    assert len(kept) == N_KEPT
    assert len(set(kept)) == N_KEPT, "유지 목록에 중복이 있다"
    assert set(kept) <= set(names), sorted(set(kept) - set(names))[:5]
    assert len(set(names) - set(kept)) == N_DROPPED


def test_skew_map_covers_every_kept_feature(feature_list):
    """계약(스펙 00): skew_transform 의 키 집합 == features."""
    kept = feature_list["features"]
    skew = feature_list["skew_transform"]
    assert set(skew) == set(kept)
    assert set(skew.values()) <= {"", "log1p", "signed_log1p"}


def test_bundle_matrices_match_feature_count(bundle_dir, feature_list):
    """model_bundle 의 모든 특징 축 길이가 270 과 같아야 한다."""
    bundle = np.load(os.path.join(bundle_dir, "model_bundle.npz"))
    n = len(feature_list["features"])
    assert bundle["pca_components"].shape == (PCA_K, n)
    for key in ("impute_median", "delta_f", "scaler_center", "scaler_scale", "pca_mean"):
        assert bundle[key].shape == (n,), "{} shape {}".format(key, bundle[key].shape)


def test_manifest_declares_same_feature_count(bundle_dir, feature_list):
    import io
    import json
    manifest = json.load(io.open(os.path.join(bundle_dir, "manifest.json"), encoding="utf-8"))
    assert int(manifest["n_features"]) == len(feature_list["features"])
    assert int(manifest["k"]) == PCA_K
