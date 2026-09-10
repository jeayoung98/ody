# -*- coding: utf-8 -*-
"""S1 대표행 선택 패리티 (spec 20, Jira S15P21A405-126).

    census 제출본 29,460,584  →  코호트 필터 + MBID 당 1행  →  곡 7,404,506

핵심 검사는 **실제 census 표본으로 원본 매니페스트와 같은 제출본을 고르는가** 다.
`work/census_all.parquet` 과 `work/v2_manifest.parquet` 이 있어야 하고 없으면 skip 한다.
설정 파일(지문 CSV, 코호트 결정)만 필요한 검사는 대용량 없이 돈다.
"""
import os
import sys

import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "spark", "jobs"))

import manifest_rows as S1  # noqa: E402

TARGET_ROWS = 7_404_506
CENSUS_ROWS = 29_460_584
SAMPLE_MBIDS = 300


# --- 설정만 필요한 검사 ------------------------------------------------------

def test_cohort_matches_decision_file():
    """FP_RANK 와 결정 파일의 코호트가 같은 집합이어야 한다."""
    cohort, expected = S1.load_cohort()
    assert cohort == sorted(S1.FP_RANK) == [71, 72, 73, 74, 76, 87, 99, 101, 103]
    if expected is not None:
        assert int(expected) == TARGET_ROWS


def test_fingerprint_table_is_four_string_match():
    """코호트 판정 키가 네 문자열이어야 한다. 단일 컬럼 비교면 안 된다."""
    table = S1.rank_table()
    assert len(table) == len(S1.FP_RANK)
    for keys in table:
        assert len(keys) == 4
        assert all(isinstance(k, str) for k in keys)
    ranks = sorted(rank for rank, _fp in table.values())
    assert ranks == list(range(len(S1.FP_RANK)))


def test_rank_order_follows_fp_rank():
    """규모 순위가 74 > 72 > 73 > 76 > 99 > 71 > 101 > 103 > 87 이어야 한다."""
    table = S1.rank_table()
    by_rank = sorted(table.values())
    assert [fp for _rank, fp in by_rank] == S1.FP_RANK


def test_sort_key_priority_order():
    """정렬 키가 lossless → 44100 → 규모 → part → offset 순서로 작동한다."""
    table = S1.rank_table()
    keys = list(table)
    best_fp_keys, worse_fp_keys = None, None
    for k in keys:
        if table[k][1] == S1.FP_RANK[0]:
            best_fp_keys = k
        if table[k][1] == S1.FP_RANK[-1]:
            worse_fp_keys = k

    def row(fp_keys, lossless=True, sample_rate=44100.0, part=0, offset=0):
        base = dict(zip(S1.FP_KEY_COLUMNS, fp_keys))
        base.update({"lossless": lossless, "sample_rate": sample_rate,
                     "part": part, "offset": offset, "mbid": "m"})
        return base

    lossless = S1.sort_key(row(best_fp_keys, lossless=True), table)
    lossy = S1.sort_key(row(best_fp_keys, lossless=False), table)
    assert lossless < lossy, "lossless 가 먼저여야 한다"

    at_44k = S1.sort_key(row(best_fp_keys, sample_rate=44100.0), table)
    off_44k = S1.sort_key(row(best_fp_keys, sample_rate=48000.0), table)
    assert at_44k < off_44k, "44100 이 먼저여야 한다"

    missing_sr = S1.sort_key(row(best_fp_keys, sample_rate=None), table)
    assert at_44k < missing_sr, "결측 sample_rate 는 뒤로 가야 한다"

    strong_fp = S1.sort_key(row(best_fp_keys), table)
    weak_fp = S1.sort_key(row(worse_fp_keys), table)
    assert strong_fp < weak_fp, "규모 순위가 앞선 지문이 먼저여야 한다"

    early_part = S1.sort_key(row(best_fp_keys, part=0), table)
    late_part = S1.sort_key(row(best_fp_keys, part=5), table)
    assert early_part < late_part

    early_off = S1.sort_key(row(best_fp_keys, offset=0), table)
    late_off = S1.sort_key(row(best_fp_keys, offset=99), table)
    assert early_off < late_off


def test_non_cohort_row_is_not_a_candidate():
    """코호트 밖 지문은 후보가 아니다."""
    table = S1.rank_table()
    row = {c: "없는값" for c in S1.FP_KEY_COLUMNS}
    row.update({"lossless": True, "sample_rate": 44100.0, "part": 0, "offset": 0, "mbid": "m"})
    assert S1.sort_key(row, table) is None
    assert S1.pick_representative([row], table) is None


def test_fit_sample_is_not_an_output_column():
    """is_fit_sample 은 내지 않는다. fit 산물이라 Spark 로 재현 불가(규칙 3)."""
    assert "is_fit_sample" not in S1.OUTPUT_COLUMNS
    assert S1.OUTPUT_COLUMNS == ["mbid", "part", "offset", "fingerprint", "lossless", "sample_rate"]


def test_job_imports_without_pyspark():
    """pyspark 없이 import 되고 상수가 맞다."""
    assert S1.TARGET_ROWS == TARGET_ROWS
    assert S1.SAMPLE_RATE_PREFERRED == 44100.0


# --- 실제 데이터 패리티 ------------------------------------------------------

@pytest.fixture(scope="module")
def census_and_manifest(root):
    import pyarrow.parquet as pq
    work = os.environ.get("ODY_WORK") or os.path.join(root, "work")
    census = os.path.join(work, "census_all.parquet")
    manifest = os.path.join(work, "v2_manifest.parquet")
    if not (os.path.exists(census) and os.path.exists(manifest)):
        pytest.skip("census_all.parquet 또는 v2_manifest.parquet 없음")
    return census, manifest, pq


def test_census_and_manifest_row_counts(census_and_manifest):
    census, manifest, pq = census_and_manifest
    assert pq.ParquetFile(census).metadata.num_rows == CENSUS_ROWS
    assert pq.ParquetFile(manifest).metadata.num_rows == TARGET_ROWS


def test_parity_picks_same_submission_as_manifest(census_and_manifest):
    """실제 census 표본에서 원본 매니페스트와 같은 (part, offset, fingerprint) 를 고른다.

    이 검사가 통과하면 Spark 잡이 쓰는 정렬 순서가 원본과 같다는 뜻이다.
    """
    census, manifest, pq = census_and_manifest
    table = S1.rank_table()

    rng = np.random.default_rng(7)
    man = pq.read_table(manifest, columns=["mbid", "part", "offset", "fingerprint",
                                           "lossless", "sample_rate"])
    total = man.num_rows
    take = rng.choice(total, SAMPLE_MBIDS, replace=False)
    expected = {}
    mbid_col = man.column("mbid").to_pylist()
    part_col = man.column("part").to_pylist()
    off_col = man.column("offset").to_pylist()
    fp_col = man.column("fingerprint").to_pylist()
    for i in take:
        expected[mbid_col[i]] = (int(part_col[i]), int(off_col[i]), int(fp_col[i]))
    del man, mbid_col, part_col, off_col, fp_col

    wanted = set(expected)
    grouped = {m: [] for m in wanted}
    columns = ["mbid", "part", "offset", "lossless", "sample_rate"] + list(S1.FP_KEY_COLUMNS)
    pf = pq.ParquetFile(census)
    for rg in range(pf.num_row_groups):
        table_rg = pf.read_row_group(rg, columns=columns)
        mb = table_rg.column("mbid").to_pylist()
        hit = [i for i, m in enumerate(mb) if m in wanted]
        if not hit:
            continue
        cols = {c: table_rg.column(c).to_pylist() for c in columns}
        for i in hit:
            grouped[mb[i]].append({c: cols[c][i] for c in columns})

    checked = 0
    for mbid, rows in grouped.items():
        if not rows:
            continue
        picked = S1.pick_representative(rows, table)
        assert picked is not None, mbid
        got = (picked["part"], picked["offset"], picked["fingerprint"])
        assert got == expected[mbid], (mbid, got, expected[mbid])
        checked += 1
    assert checked >= SAMPLE_MBIDS * 0.9, "표본 {}개 중 {}개만 확인됐다".format(SAMPLE_MBIDS, checked)
