# -*- coding: utf-8 -*-
"""AC4: serving/CURRENT.json 이 가리키는 번들이 계약을 만족한다 (커밋 훅이 실행)."""
import io, json, os, sys
import pytest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, "tests"))
from check_contract import check_bundle  # noqa: E402


def current_bundle():
    """번들 대용량 파일이 없는 머신(팀 clone)에서는 skip — 완전 검증은 데이터 볼륨이 붙은 머신에서."""
    cur = json.load(io.open(os.path.join(ROOT, "serving", "CURRENT.json"), encoding="utf-8"))
    path = os.path.join(ROOT, "serving", cur["bundle"])
    if not os.path.exists(os.path.join(path, "coords_v2.parquet")):
        pytest.skip("번들 대용량 파일 없음: " + path)
    return path, cur


def test_current_pointer_exists():
    path, cur = current_bundle()
    assert os.path.isdir(path), path
    assert cur["bundle"].startswith("v")


def test_current_bundle_contract():
    path, cur = current_bundle()
    strict = bool(cur.get("strict", False))   # v2.2 부터 CURRENT.json 에 strict:true
    R = check_bundle(path, strict=strict)
    fails = [(n, m) for s, n, m in R.items if s == "FAIL"]
    assert not fails, fails
