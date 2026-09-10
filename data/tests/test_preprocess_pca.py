# -*- coding: utf-8 -*-
"""S2 전처리·S3 PCA 패리티 (spec 20, Jira S15P21A405-130).

    추출 특징 270  →  S2(skew·delta_f·impute·scaler·clip)  →  S3(PCA)  →  pc1..pc16

핵심 검사는 **실제 특징 파일을 두 잡에 통과시킨 좌표가 `coords_v2.parquet` 과 같은가** 다.
스펙 20 의 S3 패리티 기준이 최대 절대 오차 < 1e-4 이고, 그 수치를 여기서 만든다.
번들(`model_bundle.npz`)이나 특징 파일이 없는 머신에서는 skip 한다.
"""
import io
import json
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))

import pca as S3  # noqa: E402
import preprocess as S2  # noqa: E402

MAX_ABS_ERROR = 1e-4               # 스펙 20 S3 패리티 기준
SAMPLE_ROWS = 3000
N_FEATURES = 270


@pytest.fixture(scope="module")
def bundle(bundle_dir):
    """CURRENT 번들의 동결 파라미터. bundle_dir fixture 가 대용량 없으면 skip 한다."""
    if not os.path.exists(os.path.join(bundle_dir, "model_bundle.npz")):
        pytest.skip("model_bundle.npz 없음")
    return S2.load_bundle(bundle_dir)


def test_bundle_shapes(bundle):
    """270개 특징과 16개 성분. 이름·순서는 feature_list.json 이 정한다."""
    assert len(bundle["kept"]) == N_FEATURES
    assert len(S2.FEATURE_COLUMNS) == N_FEATURES
    assert bundle["pca_components"].shape == (16, N_FEATURES)
    for key in ("delta_f", "impute_median", "scaler_center", "scaler_scale", "pca_mean"):
        assert bundle[key].shape == (N_FEATURES,)
    assert bundle["clip"] > 0


def test_feature_order_follows_feature_list(bundle, bundle_dir):
    feature_list = json.load(io.open(os.path.join(bundle_dir, "feature_list.json"), encoding="utf-8"))
    assert bundle["kept"] == feature_list["features"]
    assert set(bundle["skew"]) == set(bundle["kept"])


def test_jobs_do_not_refit():
    """재학습 금지(규칙 3). fit 호출이 소스에 없어야 한다."""
    for name in ("preprocess.py", "pca.py"):
        source = io.open(os.path.join(ROOT, "spark", "jobs", name), encoding="utf-8").read()
        assert ".fit(" not in source
        assert "fit_transform" not in source


def test_skew_transform_touches_only_listed_columns(bundle):
    """skew 단계는 feature_list 가 지정한 컬럼만 바꾼다."""
    X = np.full((1, N_FEATURES), 3.0)
    out = S2.apply_skew(X, bundle)
    for j, name in enumerate(bundle["kept"]):
        kind = bundle["skew"].get(name, "")
        if kind == "":
            assert out[0, j] == 3.0, name
        else:
            assert out[0, j] != 3.0, name


def test_delta_f_applies_to_lossy_rows_only(bundle):
    """delta_f 보정은 lossless=false 행에만 들어간다."""
    X = np.tile(bundle["impute_median"], (2, 1))
    Z = S2.transform(X, np.array([True, False]), bundle)
    moved = np.flatnonzero(bundle["delta_f"] != 0)
    assert len(moved), "번들의 delta_f 가 전부 0 이면 이 검사는 의미가 없다"
    assert not np.allclose(Z[0][moved], Z[1][moved])


def test_missing_values_become_median_then_zero_after_scaling(bundle):
    """결측은 impute_median 으로 채운다. 중앙값 행은 스케일 후 center 와의 차이만 남는다."""
    X = np.full((1, N_FEATURES), np.nan)
    Z = S2.transform(X, np.array([True]), bundle)
    assert np.isfinite(Z).all()
    expected = np.clip((bundle["impute_median"] - bundle["scaler_center"]) / bundle["scaler_scale"],
                       -bundle["clip"], bundle["clip"])
    assert np.allclose(Z[0], expected)


def test_clip_bounds_output(bundle):
    """무한대·거대한 값도 ±winsorize_clip 안으로 들어온다."""
    X = np.full((2, N_FEATURES), 0.0)
    X[0] = 1e30
    X[1] = -1e30
    with np.errstate(invalid="ignore"):      # 기준 구현도 log1p(음수) 에서 NaN 을 낸다
        Z = S2.transform(X, np.array([True, True]), bundle)
    assert np.isfinite(Z).all()
    assert np.abs(Z).max() <= bundle["clip"] + 1e-12


def test_pca_rejects_wrong_width(bundle):
    with pytest.raises(ValueError):
        S3.project(np.zeros((2, 5)), bundle)


def test_pca_output_columns():
    assert S3.PC_COLUMNS[0] == "pc1" and S3.PC_COLUMNS[-1] == "pc16"


# --- 실제 데이터 패리티 ------------------------------------------------------

@pytest.fixture(scope="module")
def feats_file(root):
    path = os.environ.get("ODY_WORK") or os.path.join(root, "work")
    feats = os.path.join(path, "v2_feats")
    if not os.path.isdir(feats):
        pytest.skip("work/v2_feats 없음")
    names = sorted(f for f in os.listdir(feats) if f.endswith(".parquet"))
    if not names:
        pytest.skip("v2_feats 에 parquet 없음")
    return os.path.join(feats, names[0])


def test_chain_matches_coords(bundle, bundle_dir, feats_file):
    """S2 → S3 을 통과한 좌표가 coords_v2.parquet 과 1e-4 안에서 같다.

    이 검사가 스펙 20 S3 패리티 기준을 만든다. 잡의 numpy 경로(mapInPandas 안에서 도는 것과
    같은 함수)를 쓰므로 pyspark 없이도 수치를 확인할 수 있다.
    """
    import pyarrow.parquet as pq

    table = pq.read_table(feats_file, columns=["mbid", "lossless"] + bundle["kept"])
    rng = np.random.default_rng(9)
    take = rng.choice(table.num_rows, min(SAMPLE_ROWS, table.num_rows), replace=False)
    table = table.take(take)
    X = np.column_stack([table.column(name).to_numpy(zero_copy_only=False).astype(np.float64)
                         for name in bundle["kept"]])
    lossless = table.column("lossless").to_numpy(zero_copy_only=False)
    mbids = [m.lower() for m in table.column("mbid").to_pylist()]
    del table

    coords = S3.project(S2.transform(X, lossless, bundle), bundle)
    assert coords.shape == (len(mbids), 16)
    assert np.isfinite(coords).all()

    wanted = set(mbids)
    truth = {}
    coord_file = pq.ParquetFile(os.path.join(bundle_dir, "coords_v2.parquet"))
    for rg in range(coord_file.metadata.num_row_groups):
        chunk = coord_file.read_row_group(rg, columns=["mbid"] + S3.PC_COLUMNS)
        found = chunk.column("mbid").to_pylist()
        hit = [i for i, mbid in enumerate(found) if mbid.lower() in wanted]
        if hit:
            matrix = np.column_stack([chunk.column(pc).to_numpy(zero_copy_only=False)
                                      for pc in S3.PC_COLUMNS])
            for i in hit:
                truth[found[i].lower()] = matrix[i]

    errors = np.array([np.abs(coords[i] - truth[mbid].astype(np.float64)).max()
                       for i, mbid in enumerate(mbids) if mbid in truth])
    assert len(errors) > SAMPLE_ROWS * 0.5, "대조된 곡이 {}개뿐이다".format(len(errors))
    assert errors.max() < MAX_ABS_ERROR, "최대 절대 오차 {:.3e}".format(errors.max())
