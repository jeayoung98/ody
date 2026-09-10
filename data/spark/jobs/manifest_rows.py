# -*- coding: utf-8 -*-
"""S1 대표행 선택 (spec 20, Jira S15P21A405-126).

    census 제출본 29,460,584  →  코호트 필터  →  MBID 당 1행  →  곡 7,404,506

곡 수를 줄이는 단계는 파이프라인에 둘이다. 이 잡이 첫 번째이고, 두 번째가 S5 카탈로그 규칙
(R1~R9, 780,107곡 제외 → 6,624,399)이다. 차원을 줄이는 단계는 따로 셋이다(S1.5a, S1.5b, S3).

## 규칙 (완전 결정적, `dmadkr/scripts/build_v2_manifest.py` 이식)

    1. 코호트 9개 지문의 제출본만 후보
    2. lossless 우선
    3. sample_rate == 44100 우선 (결측은 뒤로)
    4. 지문 규모 순위  74 > 72 > 73 > 76 > 99 > 71 > 101 > 103 > 87
    5. part 오름차순 → offset 오름차순      최종 동률 제거자

### 코호트 판정은 네 문자열 일치다
census 에 `fingerprint` 컬럼이 있는 것이 아니다. `essentia`, `essentia_git_sha`,
`essentia_build_sha`, `extractor` **네 값이 모두** 정의와 같을 때 그 지문으로 본다.
정의는 `pipeline/version_census_fingerprints.csv` 이고 코호트 목록은
`pipeline/v2_cohort_decision.json` 의 `cohort_fingerprints` 다(`CONFIRMED_BY_GATE_V2`).

### `is_fit_sample` 은 내지 않는다
원본은 `numpy.default_rng(42)` 로 층(part × lossless)마다 `rng.choice` 를 불러 fit 표본
100만 곡을 뽑는다. **호출 순서에 의존하므로 Spark 로 같은 결과를 낼 수 없다.**

다만 이것은 fit 산물이고 규칙 3 상 재계산 대상이 아니다. S2·S3 은 동결 파라미터를 적용만
하므로 fit 표본이 필요 없다. 필요하면 기존 `work/v2_manifest.parquet` 에서 조인한다.
"""
import argparse
import csv
import io
import json
import os

# 지문 규모 순위. 앞일수록 우선한다. 원본 build_v2_manifest.FP_RANK 와 같아야 한다.
FP_RANK = [74, 72, 73, 76, 99, 71, 101, 103, 87]
TARGET_ROWS = 7_404_506
SAMPLE_RATE_PREFERRED = 44100.0

# census 에서 코호트를 판정하는 네 컬럼.
FP_KEY_COLUMNS = ("essentia", "essentia_git_sha", "essentia_build_sha", "extractor")
OUTPUT_COLUMNS = ["mbid", "part", "offset", "fingerprint", "lossless", "sample_rate"]

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FINGERPRINT_CSV = os.path.join(ROOT, "pipeline", "version_census_fingerprints.csv")
COHORT_DECISION = os.path.join(ROOT, "pipeline", "v2_cohort_decision.json")


def load_fingerprints(csv_path=None):
    """fp 번호 → 네 문자열. 헤더에 BOM 이 있어 utf-8-sig 로 읽는다."""
    path = csv_path or FINGERPRINT_CSV
    out = {}
    with io.open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            out[int(row["fp"])] = tuple(row[c] for c in FP_KEY_COLUMNS)
    return out


def load_cohort(decision_path=None):
    """코호트 지문 번호 목록. FP_RANK 와 집합이 같아야 한다."""
    path = decision_path or COHORT_DECISION
    decision = json.load(io.open(path, encoding="utf-8"))
    cohort = sorted(decision["cohort_fingerprints"])
    if cohort != sorted(FP_RANK):
        raise ValueError("FP_RANK {} 와 결정 파일의 코호트 {} 가 다르다".format(sorted(FP_RANK), cohort))
    return cohort, decision.get("expected_unique_songs")


def rank_table(csv_path=None, decision_path=None):
    """(네 문자열) → (rank, fp). rank 가 작을수록 우선. 코호트 밖 지문은 넣지 않는다."""
    fingerprints = load_fingerprints(csv_path)
    cohort, _ = load_cohort(decision_path)
    table = {}
    for rank, fp in enumerate(FP_RANK):
        if fp not in cohort:
            continue
        if fp not in fingerprints:
            raise ValueError("지문 {} 가 CSV 에 없다".format(fp))
        table[fingerprints[fp]] = (rank, fp)
    return table


# --------------------------------------------------------------------------
# numpy 기준 구현 — 패리티 테스트가 쓰고, Spark 판정과 같은 순서를 정의한다
# --------------------------------------------------------------------------
def sort_key(row, table):
    """정렬 키. 작을수록 먼저 뽑힌다. row 는 census 한 행의 dict.

    반환 None 이면 코호트 밖이라 후보가 아니다.
    """
    hit = table.get(tuple(row[c] for c in FP_KEY_COLUMNS))
    if hit is None:
        return None
    rank, _fp = hit
    not_lossless = 0 if row["lossless"] else 1
    sample_rate = row["sample_rate"]
    is_44k = sample_rate is not None and float(sample_rate) == SAMPLE_RATE_PREFERRED
    not_44k = 0 if is_44k else 1
    return (not_lossless, not_44k, rank, int(row["part"]), int(row["offset"]))


def pick_representative(rows, table):
    """한 mbid 의 census 행들에서 대표 1행. 후보가 없으면 None."""
    best, best_key = None, None
    for row in rows:
        key = sort_key(row, table)
        if key is None:
            continue
        if best_key is None or key < best_key:
            best, best_key = row, key
    if best is None:
        return None
    fingerprint = table[tuple(best[c] for c in FP_KEY_COLUMNS)][1]
    return {"mbid": best["mbid"], "part": int(best["part"]), "offset": int(best["offset"]),
            "fingerprint": fingerprint, "lossless": bool(best["lossless"]),
            "sample_rate": best["sample_rate"]}


# --------------------------------------------------------------------------
# Spark
# --------------------------------------------------------------------------
def select_representatives(df, table):
    """census DataFrame → MBID 당 1행. 정렬 키 순서가 numpy 판정과 같다."""
    from pyspark.sql import Window, functions as F

    # 네 문자열 → rank·fingerprint 를 CASE 식으로 만든다. 코호트는 9개뿐이라 조인보다 싸다.
    rank_expr, fp_expr = F.lit(None), F.lit(None)
    for keys, (rank, fp) in sorted(table.items(), key=lambda kv: kv[1][0]):
        match = F.lit(True)
        for column, value in zip(FP_KEY_COLUMNS, keys):
            match = match & (F.col(column) == F.lit(value))
        rank_expr = F.when(match, F.lit(rank)).otherwise(rank_expr)
        fp_expr = F.when(match, F.lit(fp)).otherwise(fp_expr)

    scored = (df
              .withColumn("_rank", rank_expr)
              .withColumn("fingerprint", fp_expr)
              .filter(F.col("_rank").isNotNull())          # 1. 코호트 필터
              .withColumn("_not_lossless", F.when(F.col("lossless"), 0).otherwise(1))
              .withColumn("_not_44k",
                          F.when(F.col("sample_rate") == F.lit(SAMPLE_RATE_PREFERRED), 0).otherwise(1)))

    # 결측·NaN sample_rate 는 조건이 참이 아니므로 otherwise 로 1 이 된다. numpy 쪽과 같다.
    order = ["_not_lossless", "_not_44k", "_rank", "part", "offset"]
    window = Window.partitionBy("mbid").orderBy(*[F.col(c).asc() for c in order])
    return (scored
            .withColumn("_row", F.row_number().over(window))
            .filter(F.col("_row") == 1)
            .select(*OUTPUT_COLUMNS))


def run(spark, input_path, output_path, expect_rows=None):
    table = rank_table()
    df = spark.read.parquet(input_path)
    picked = select_representatives(df, table)
    picked.write.mode("overwrite").parquet(output_path)
    rows = picked.count()
    report = {"stage": "S1", "input_path": input_path, "output_path": output_path,
              "output_rows": rows, "cohort_fingerprints": sorted(FP_RANK),
              "fp_rank": FP_RANK, "is_fit_sample": "재현하지 않음 (fit 산물, 규칙 3)"}
    if expect_rows:
        report["expected_rows"] = int(expect_rows)
        report["rows_match"] = rows == int(expect_rows)
    return report


def main():
    ap = argparse.ArgumentParser(description="S1 대표행 선택")
    ap.add_argument("--in", dest="input_path", required=True, help="census parquet (hdfs:///...)")
    ap.add_argument("--out", dest="output_path", required=True)
    ap.add_argument("--expect-rows", type=int, default=TARGET_ROWS,
                    help="기대 행 수. 0 이면 검사하지 않는다")
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-manifest-rows").getOrCreate()
    try:
        report = run(spark, args.input_path, args.output_path,
                     expect_rows=args.expect_rows or None)
        print(json.dumps(report, ensure_ascii=False))
        if report.get("rows_match") is False:
            raise SystemExit("행 수 불일치: {} != {}".format(
                report["output_rows"], report["expected_rows"]))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
