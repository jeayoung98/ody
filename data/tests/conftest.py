# -*- coding: utf-8 -*-
"""공용 fixture. 대용량 파일이 없는 머신(팀 clone)에서는 번들을 요구하는 테스트를 skip 한다.
완전 검증은 데이터 볼륨(또는 junction)이 붙은 개발 머신에서만 유효하다."""
import io, json, os, sys
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in ("tests", "scripts"):
    sys.path.insert(0, os.path.join(ROOT, p))
sys.path.insert(0, ROOT)


@pytest.fixture(scope="session")
def root():
    return ROOT


@pytest.fixture(scope="session")
def current():
    """serving/CURRENT.json 내용."""
    return json.load(io.open(os.path.join(ROOT, "serving", "CURRENT.json"), encoding="utf-8"))


@pytest.fixture(scope="session")
def bundle_dir(current):
    """CURRENT 가 가리키는 번들 경로. coords_v2.parquet 이 없으면 skip."""
    path = os.path.join(ROOT, "serving", current["bundle"])
    if not os.path.exists(os.path.join(path, "coords_v2.parquet")):
        pytest.skip("번들 대용량 파일 없음: " + path)
    return path


@pytest.fixture(scope="session")
def rules(current):
    """현재 번들의 postprocess_rules.json (json 만 있으면 됨, 대용량 불필요)."""
    return json.load(io.open(os.path.join(ROOT, "serving", current["bundle"], "postprocess_rules.json"), encoding="utf-8"))
