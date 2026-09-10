# -*- coding: utf-8 -*-
"""S2 전처리 (spec 20, Jira S15P21A405-130).

    추출 특징 270개(원값)  →  skew → delta_f → impute → scaler → clip  →  270 float32

**재학습하지 않는다**(규칙 3). `serving/<v>/model_bundle.npz` 와 `feature_list.json` 의
동결 파라미터를 적용만 한다. 기준 구현은 `scripts/korean_common.py` 의 `serving_transform` 이다.

## 다섯 단계 (순서가 곧 정의다)

    1. skew 변환      feature_list.skew_transform 이 지정한 컬럼만 log1p / signed_log1p
    2. delta_f 보정   lossless=false 행에만 더한다. 손실 압축이 특징을 밀어낸 만큼 되돌린다
    3. impute        남은 결측(NaN)을 impute_median 으로 채운다
    4. scaler        (x - scaler_center) / scaler_scale. RobustScaler 의 동결 계수다
    5. clip          NaN·무한대를 0 으로 만든 뒤 ±winsorize_clip 으로 자른다

계산은 float64 로 하고 저장만 float32 다. 기준 구현이 float64 라서 그렇다.

## 왜 mapInPandas 인가
270개 컬럼에 5단계를 컬럼식으로 쓰면 표현식 트리가 1,000개 노드를 넘어 Catalyst 가 느려진다.
`mapInPandas` 는 Arrow 배치를 그대로 numpy 로 받아 기준 구현과 **같은 연산**을 executor 에서
돌린다. 분산도 유지되고 패리티도 정확해진다.

## 번들을 클러스터로 보내는 방법
`--bundle` 로 디렉터리를 준다. `spark-submit --files` 로 `model_bundle.npz` 와
`feature_list.json` 을 함께 올리고 `--bundle .` 을 주는 것이 가장 간단하다. 자세한 명령은
`spark/README.md`.
"""
import argparse
import io
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURE_COLUMNS = ["f_{:03d}".format(i) for i in range(270)]
CARRY_COLUMNS = ["mbid"]                  # 전처리 뒤에도 들고 가는 컬럼


def default_bundle_dir():
    """serving/CURRENT.json 이 가리키는 번들. 환경변수 ODY_SERVING_DIR 를 먼저 본다."""
    serving = os.environ.get("ODY_SERVING_DIR") or os.path.join(ROOT, "serving")
    with io.open(os.path.join(serving, "CURRENT.json"), encoding="utf-8") as fh:
        return os.path.join(serving, json.load(fh)["bundle"])


def load_bundle(bundle_dir=None):
    """동결 파라미터. 여기서 읽는 것 말고 이 잡에 숫자는 없다.

    반환 dict: kept(270 이름), skew(이름→변환), delta_f, impute_median, scaler_center,
    scaler_scale, clip, pca_mean, pca_components. 뒤 둘은 S3 이 쓴다.
    """
    bundle_dir = bundle_dir or default_bundle_dir()
    with io.open(os.path.join(bundle_dir, "feature_list.json"), encoding="utf-8") as fh:
        feature_list = json.load(fh)
    npz = np.load(os.path.join(bundle_dir, "model_bundle.npz"))
    kept = list(feature_list["features"])
    if len(kept) != len(FEATURE_COLUMNS):
        raise ValueError("특징 수 {} 가 270 이 아니다".format(len(kept)))
    out = {"dir": bundle_dir, "kept": kept, "skew": feature_list["skew_transform"],
           "clip": float(npz["winsorize_clip"])}
    for key in ("delta_f", "impute_median", "scaler_center", "scaler_scale",
                "pca_mean", "pca_components"):
        out[key] = npz[key].astype(np.float64)
    return out


def apply_skew(X, bundle):
    """1단계. feature_list 가 지정한 컬럼만 바꾼다. 나머지는 원값 그대로."""
    X = np.asarray(X, dtype=np.float64).copy()
    for j, name in enumerate(bundle["kept"]):
        transform = bundle["skew"].get(name, "")
        if transform == "log1p":
            X[:, j] = np.log1p(X[:, j])
        elif transform == "signed_log1p":
            X[:, j] = np.sign(X[:, j]) * np.log1p(np.abs(X[:, j]))
    return X


def transform(X_raw, lossless, bundle):
    """2~5단계까지 전부. 반환은 (n, 270) float64. 기준 serving_transform 의 'scaled' 다."""
    X = apply_skew(X_raw, bundle)
    lossy = ~np.asarray(lossless, dtype=bool)
    X[lossy] += bundle["delta_f"]
    X = np.where(np.isnan(X), bundle["impute_median"], X)
    Z = (X - bundle["scaler_center"]) / bundle["scaler_scale"]
    Z = np.nan_to_num(Z, nan=0.0, posinf=0.0, neginf=0.0)
    return np.clip(Z, -bundle["clip"], bundle["clip"])


# --------------------------------------------------------------------------
# Spark
# --------------------------------------------------------------------------
def output_schema():
    from pyspark.sql.types import FloatType, StringType, StructField, StructType
    fields = [StructField(name, StringType(), False) for name in CARRY_COLUMNS]
    fields += [StructField(name, FloatType(), True) for name in FEATURE_COLUMNS]
    return StructType(fields)


def quoted(name):
    """특징 이름은 `lowlevel.gfcc.mean.0` 처럼 점을 포함한다.

    그대로 `select` 에 넘기면 Spark 가 **중첩 필드 접근으로 해석**해서 컬럼을 못 찾는다
    (2026-09-10 클러스터 제출에서 `UNRESOLVED_COLUMN.WITH_SUGGESTION` 로 실패했다).
    백틱으로 감싸야 한 컬럼 이름으로 읽는다.
    """
    return "`{}`".format(name.replace("`", "``"))


def feature_selection(bundle):
    """select 에 넘길 컬럼식. 270개 특징을 f_000..f_269 로 바꿔 담는다.

    이름을 바꾸는 이유는 점 때문에 pandas 쪽에서도 헷갈리기 쉽고, 출력 스키마가 이미
    f_000..f_269 이기 때문이다. 순서는 feature_list.json 그대로다.
    """
    from pyspark.sql import functions as F
    return [F.col(quoted(name)).alias(FEATURE_COLUMNS[j])
            for j, name in enumerate(bundle["kept"])]


def preprocess_df(df, bundle):
    """추출 특징 DataFrame → 전처리된 270 float32.

    입력에 필요한 컬럼: mbid, lossless, 그리고 feature_list 의 270개 특징 이름 그대로.
    """
    import pandas as pd
    from pyspark.sql import functions as F

    schema = output_schema()
    columns = [F.col(name) for name in CARRY_COLUMNS] + [F.col("lossless")] + feature_selection(bundle)

    def run(batches):
        for batch in batches:
            values = batch[FEATURE_COLUMNS].to_numpy(dtype=np.float64)
            Z = transform(values, batch["lossless"].to_numpy(), bundle)
            out = pd.DataFrame(Z.astype(np.float32), columns=FEATURE_COLUMNS,
                               index=batch.index)
            for name in CARRY_COLUMNS:
                out.insert(0, name, batch[name])
            yield out

    return df.select(*columns).mapInPandas(run, schema=schema)


def run(spark, input_path, output_path, bundle_dir=None, sample=None):
    bundle = load_bundle(bundle_dir)
    df = spark.read.parquet(input_path)
    if sample:
        df = df.limit(int(sample))
    out = preprocess_df(df, bundle)
    out.write.mode("overwrite").parquet(output_path)
    written = spark.read.parquet(output_path)
    return {"stage": "S2", "input_path": input_path, "output_path": output_path,
            "input_rows": df.count(), "output_rows": written.count(),
            "features": len(FEATURE_COLUMNS), "bundle": bundle["dir"],
            "clip": bundle["clip"], "refit": "없음 (동결 파라미터 적용만, 규칙 3)"}


def main():
    ap = argparse.ArgumentParser(description="S2 전처리")
    ap.add_argument("--in", dest="input_path", required=True, help="추출 특징 parquet (hdfs:///...)")
    ap.add_argument("--out", dest="output_path", required=True)
    ap.add_argument("--bundle", dest="bundle_dir", default=None,
                    help="model_bundle.npz·feature_list.json 이 있는 디렉터리")
    ap.add_argument("--sample", type=int, default=0, help="표본 행 수. 0 이면 전부")
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-preprocess").getOrCreate()
    try:
        print(json.dumps(run(spark, args.input_path, args.output_path,
                             args.bundle_dir, args.sample or None), ensure_ascii=False))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
