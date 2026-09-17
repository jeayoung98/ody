# -*- coding: utf-8 -*-
"""S5 클러스터 입력 조립 (Jira S15P21A405-395). 작은 합성 표로 컬럼·값 규칙만 본다.

실제 데이터로 만든 표가 클러스터 S5 에서 로컬 dry-run 과 같은 제외 수를 내는지는
output/spark_run_S5_<날짜>.json 의 excluded_match 가 판정한다.
"""
import os
import sys

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark"))

import build_catalog_input as B  # noqa: E402


def test_assemble_has_every_column_apply_rules_reads():
    rules = B.load_rules()
    meta = pd.DataFrame({
        "mbid": ["b", "a", "c"], "canonical": ["b", "a", "c"], "artist_norm": ["x", "y", ""],
        "artist_raw": ["X", "Y", ""], "title_raw": ["t1", "t2", ""], "length": [200.0, 30.0, 500.0],
        "sample_rate": [44100.0, 22050.0, 44100.0], "lossless": [True, False, False],
        "part": [0, 1, 2], "offset": [10, 20, 30], "fingerprint": [74, 72, 73], "n_submissions": [3, 1, 2]})
    X = np.arange(48, dtype=np.float32).reshape(3, 16)
    p15 = rules["R15_static"]["params"]
    names = list(B.SILENCE_RENAME) + list(p15["features"]) + [p15["onset_feature"]]
    features = {n: np.array([0.1, np.nan, 0.3]) for n in names}
    a5 = pd.DataFrame({"mbid": ["A", "a", "c"], "keyword": ["speech", "podcast", "comedy"]})
    a4 = pd.DataFrame({"mbid": ["c"], "n_clipped_features": [7]})

    out = B.assemble(meta, X, features, a5, a4, [True, False, True], [False, False, False], rules)

    assert list(out.columns) == B.required_columns(rules)
    assert len(out) == 3 and out["mbid"].tolist() == ["b", "a", "c"]      # 행 순서 유지
    assert out["a5_keywords"].tolist() == [[], ["podcast", "speech"], ["comedy"]]  # mbid 대소문자 무시, 정렬
    assert out["n_clipped_features"].tolist() == [0, 0, 7]
    assert out["loudness"].tolist()[0] == 0.1 and np.isnan(out["loudness"].tolist()[1])
    assert out["pc16"].tolist() == [15.0, 31.0, 47.0]
    assert out["has_tag"].tolist() == [True, False, True]
    # apply_rules 의 R15 컬럼은 JSON 이름 그대로(점 포함) 있어야 한다. 잡이 백틱으로 읽는다.
    assert all(n in out.columns for n in p15["features"])
