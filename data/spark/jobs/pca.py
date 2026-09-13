# -*- coding: utf-8 -*-
"""S3 PCA (spec 20, Jira S15P21A405-130).

    전처리된 270 float32  →  (Z - pca_mean) @ pca_components.T  →  pc1..pc16

**재학습하지 않는다**(규칙 3). `model_bundle.npz` 의 `pca_mean`·`pca_components` 를 적용만
한다. 좌표가 바뀌면 major 버전이고 게이트를 다시 등록해야 하므로 이 잡은 `fit` 을 부르지 않는다.

파라미터 로딩과 mapInPandas 를 쓰는 이유는 S2 `preprocess.py` 와 같고, 그쪽 함수를 그대로
쓴다. 그래서 클러스터 제출 때 `--py-files spark/jobs/preprocess.py` 가 필요하다.

패리티 기준은 `coords_v2.parquet` 과 최대 절대 오차 < 1e-4 다(스펙 20 S3). 2026-09-10 실측:
`work/v2_feats` 표본 2,774곡에서 S2+S3 을 통과시킨 좌표의 최대 오차가 1.86e-06 이었다.
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from preprocess import FEATURE_COLUMNS, CARRY_COLUMNS, load_bundle  # noqa: E402

PC_COLUMNS = ["pc{}".format(i) for i in range(1, 17)]


def project(Z, bundle):
    """(n, 270) → (n, 16). 기준 구현과 같은 float64 연산이다."""
    Z = np.asarray(Z, dtype=np.float64)
    if Z.shape[1] != bundle["pca_components"].shape[1]:
        raise ValueError("입력 차원 {} 가 성분 {} 와 다르다".format(
            Z.shape[1], bundle["pca_components"].shape[1]))
    return (Z - bundle["pca_mean"]) @ bundle["pca_components"].T


# --------------------------------------------------------------------------
# Spark
# --------------------------------------------------------------------------
def output_schema():
    from pyspark.sql.types import FloatType, StringType, StructField, StructType
    fields = [StructField(name, StringType(), False) for name in CARRY_COLUMNS]
    fields += [StructField(name, FloatType(), False) for name in PC_COLUMNS]
    return StructType(fields)


def pca_df(df, bundle):
    """전처리 결과 DataFrame → mbid + pc1..pc16."""
    import pandas as pd

    schema = output_schema()

    def run(batches):
        for batch in batches:
            coords = project(batch[FEATURE_COLUMNS].to_numpy(dtype=np.float64), bundle)
            out = pd.DataFrame(coords.astype(np.float32), columns=PC_COLUMNS, index=batch.index)
            for name in CARRY_COLUMNS:
                out.insert(0, name, batch[name])
            yield out

    return df.select(*(list(CARRY_COLUMNS) + FEATURE_COLUMNS)).mapInPandas(run, schema=schema)


def run(spark, input_path, output_path, bundle_dir=None):
    bundle = load_bundle(bundle_dir)
    df = spark.read.parquet(input_path)
    out = pca_df(df, bundle)
    out.write.mode("overwrite").parquet(output_path)
    written = spark.read.parquet(output_path)
    return {"stage": "S3", "input_path": input_path, "output_path": output_path,
            "input_rows": df.count(), "output_rows": written.count(),
            "dims": len(PC_COLUMNS), "bundle": bundle["dir"],
            "explained_variance_note": "번들 기록값을 쓴다. 재계산하지 않는다",
            "refit": "없음 (동결 파라미터 적용만, 규칙 3)"}


def main():
    ap = argparse.ArgumentParser(description="S3 PCA")
    ap.add_argument("--in", dest="input_path", required=True, help="S2 출력 parquet (hdfs:///...)")
    ap.add_argument("--out", dest="output_path", required=True)
    ap.add_argument("--bundle", dest="bundle_dir", default=None)
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-pca").getOrCreate()
    try:
        print(json.dumps(run(spark, args.input_path, args.output_path, args.bundle_dir),
                         ensure_ascii=False))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
