# -*- coding: utf-8 -*-
"""AC4: serving/CURRENT.json 이 가리키는 번들이 계약을 만족한다 (커밋 훅이 실행). 번들 없으면 conftest.bundle_dir 가 skip."""
import os
from check_contract import check_bundle


def test_current_pointer_exists(bundle_dir, current):
    assert os.path.isdir(bundle_dir), bundle_dir
    assert str(current["bundle"]).startswith("v")


def test_current_bundle_contract(bundle_dir, current):
    strict = bool(current.get("strict", False))   # v2.2 부터 CURRENT.json 에 strict:true
    R = check_bundle(bundle_dir, strict=strict)
    fails = [(n, m) for s, n, m in R.items if s == "FAIL"]
    assert not fails, fails
