"""Shared helpers for the Korean-music AcousticBrainz feasibility experiment.

Loads the frozen serving bundle (v1-pca16) and provides:
  - extract_270(doc): raw 270 feature values in bundle order (NaN when absent)
  - serving_transform(X_raw, lossless): the exact transform-only serving path
      skew transform -> M1 delta (lossy only) -> impute median -> RobustScaler
      -> clip +-20 -> PCA-16
Nothing here refits anything.
"""
import json
import math
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from feature_spec import COLUMNS  # noqa: E402

# 번들 경로: 예전에는 v1-pca16 이 하드코딩돼 있었다. v1 번들은 팀 저장소로 옮기지 않았고
# (규칙 4), 패리티 기준은 지금 서빙하는 번들이어야 하므로 CURRENT.json 을 따른다.
# 270 목록·skew·winsorize_clip 은 v1 과 v2.1 이 완전히 같다(2026-09-10 확인).
# 다른 것은 pca_components 뿐이고, 그건 v2 재적합 결과라 v2 기준이 맞다.
# 특정 번들을 강제하려면 ODY_BUNDLE 환경변수를 준다.
_SERVING_ROOT = os.environ.get("ODY_SERVING_DIR") or os.path.join(ROOT, "serving")
_BUNDLE = os.environ.get("ODY_BUNDLE")
if not _BUNDLE:
    with open(os.path.join(_SERVING_ROOT, "CURRENT.json"), encoding="utf-8") as _f:
        _BUNDLE = json.load(_f)["bundle"]
SERVING = os.path.join(_SERVING_ROOT, _BUNDLE)
DOC_DIR = os.environ.get("KOREAN_DOC_DIR",
                         os.path.join(ROOT, "data", "intermediate", "korean_ab_docs"))

_fl = json.load(open(os.path.join(SERVING, "feature_list.json")))
KEPT = _fl["features"]                      # 270 names, bundle order
SKEW = _fl["skew_transform"]                # name -> "" | "log1p" | "signed_log1p"
_colmap = {c[0]: c for c in COLUMNS}
KEPT_COLS = [_colmap[n] for n in KEPT]

BUNDLE = np.load(os.path.join(SERVING, "model_bundle.npz"))
CLIP = float(BUNDLE["winsorize_clip"])


def extract_270(doc):
    out = np.full(len(KEPT_COLS), np.nan, dtype=np.float64)
    for j, (_, sec, key, branch, _) in enumerate(KEPT_COLS):
        try:
            v = doc[sec][key]
            if branch is None:
                out[j] = float(v)
            elif isinstance(branch, str):
                out[j] = float(v[branch])
            else:
                br, idx = branch
                arr = v[br] if br is not None else v
                out[j] = float(arr[idx])
        except (KeyError, TypeError, IndexError, ValueError):
            pass
    return out


def apply_skew(X):
    """X: (n, 270) raw -> skew-transformed copy (matches preprocess.py)."""
    X = X.astype(np.float64).copy()
    for j, name in enumerate(KEPT):
        t = SKEW.get(name, "")
        if t == "log1p":
            X[:, j] = np.log1p(X[:, j])
        elif t == "signed_log1p":
            X[:, j] = np.sign(X[:, j]) * np.log1p(np.abs(X[:, j]))
    return X


def serving_transform(X_raw, lossless):
    """X_raw: (n, 270) raw features; lossless: (n,) bool. Returns dict of stages."""
    Xt = apply_skew(X_raw)
    Xc = Xt.copy()
    Xc[~np.asarray(lossless)] += BUNDLE["delta_f"].astype(np.float64)
    med = BUNDLE["impute_median"].astype(np.float64)
    Xi = np.where(np.isnan(Xc), med, Xc)
    Z = (Xi - BUNDLE["scaler_center"].astype(np.float64)) / BUNDLE["scaler_scale"].astype(np.float64)
    Zc = np.clip(np.nan_to_num(Z, nan=0.0, posinf=0.0, neginf=0.0), -CLIP, CLIP)
    P = (Zc - BUNDLE["pca_mean"].astype(np.float64)) @ BUNDLE["pca_components"].astype(np.float64).T
    return {"skewed": Xt, "corrected": Xc, "scaled_raw": Z, "scaled": Zc, "pca": P}


def load_usable_docs():
    """Yield (mbid, offset, doc) for every cached usable submission."""
    for fn in sorted(os.listdir(DOC_DIR)):
        if not fn.endswith(".json"):
            continue
        base = fn[:-5]
        mbid, _, off = base.rpartition("-")
        with open(os.path.join(DOC_DIR, fn), encoding="utf-8") as f:
            yield mbid, int(off), json.load(f)
