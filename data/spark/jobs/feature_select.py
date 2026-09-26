# -*- coding: utf-8 -*-
"""S1.5 특징 선택 (spec 20, Jira S15P21A405-119).

파이프라인 전체 사슬은 이렇다.

    원본 JSON 수치 잎 약 2,929  →  389  →  270  →  PCA-16

이 잡은 앞의 두 컷을 담당한다. 뒤의 270 → 16 은 `pca.py`(S3) 다.

## S1.5a  약 2,929 → 389   규칙, 데이터 불필요, Spark 가 재현
`feature_spec.build_columns()` 가 이름과 순서를 결정론적으로 만든다. 버리는 근거 네 가지.

| 버리는 것 | 이유 |
|---|---|
| `cov` / `icov` 행렬 (mfcc 13×13, gfcc 13×13, icov 각각) | mean 벡터의 2차 통계다. 곡 간 비교에 정보가 거의 없고 차원만 폭발한다. 상관은 PCA 가 잡는다 |
| 통계팩 9갈래 중 6개 (`median` `min` `max` `dmean` `dvar` `dvar2`) | `mean`(중심) `var`(퍼짐) `dmean2`(프레임 간 변화율) 세 개로 분포 요약이 충분하다. 나머지는 강한 상관 |
| `beats_position` | 곡마다 길이가 다르다. 고정 차원 벡터로 못 만든다 |
| `metadata.*`, 문자열(`key_key` `chords_scale` 등) | 숫자가 아니다. 키·스케일은 별도 컬럼으로 보관한다(표시·진단용) |

389 구성: 통계팩 스칼라 41 × 3 = 123, bpm 피크 6, 리스트 mean 187, 고정 리스트 60, plain 13.
블록으로는 timbre 247 / tonal 109 / dynamics 20 / rhythm 13.

원본 문서의 수치 잎 총계는 곡마다 다르다(`beats_position` 길이 때문). 실측 표본 하나가 3,034개였고
WBS 기록값은 2,929다. **버리는 규칙이 개수를 고정하는 것이지 입력 개수가 고정된 것이 아니다.**

## S1.5b  389 → 270   데이터 fit, 적용만 (규칙 3)
같은 곡인데 인코딩이 다르면(mp3 128k vs FLAC) 특징값이 흔들린다. 흔들리는 특징을 남기면 같은 곡이
지도에서 멀어진다. 실험 A(`dmadkr/scripts/exp_a.py`)가 특징마다 안정성을 재고 임계 미만을 버렸다.

    S_f = median(|무작위 두 곡 차이|) / median(|같은 곡 다른 인코딩 차이|)     둘 다 IQR 로 정규화
    분자 = 이 특징이 곡을 구분하는 폭
    분모 = 이 특징이 인코딩 때문에 흔들리는 폭
    S_f < 2.0 이면 신호가 노이즈의 2배 미만 → 버린다

같은 파일 재제출(md5 동일) 쌍 34,060개는 제외했다. 교차 인코딩 쌍(lossless↔lossy)만 분모로 쓰는
보수 기준 `S_f_cross` 를 채택했다. 결과 119개 제거, 270 유지. 검증 AUC 0.780 → 0.881.
블록 구성이 389(247/109/20/13) → 270(170/79/11/10) 으로 바뀌었고 고주파 timbre 가 집중 제거됐다.

**Spark 에서 재fit 하지 않는다.** `feature_list.json` 의 270개 이름과 **순서**를 그대로 select 한다.
순서가 바뀌면 PCA 행렬(16×270) 곱이 조용히 깨진다.

## 입력이 이미 270 인 경우
`work/v2_feats` 는 추출기가 `extract_270` 으로 270개를 직접 뽑아 둔 **체크포인트**다(메타 12 + 특징 270).
그 파일로 시작하면 이 잡은 순서만 맞추고 통과시킨다. 앞 두 컷이 없어지는 것이 아니라, 이미 적용된
지점에서 파이프라인에 들어가는 것이다. `--from-raw` 로 원본 JSON 부터 돌릴 수 있다.
"""
import argparse
import io
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts"))

from feature_spec import COLUMNS, FEATURE_NAMES, STRING_FEATURES  # noqa: E402

N_STRUCTURAL = 389
N_KEPT = 270
# 원본에서 가져오는 비특징 컬럼. 뒤 단계(S1 대표행·S5 카탈로그)가 쓴다.
META_COLUMNS = ["mbid", "part", "offset", "fingerprint", "codec", "bit_rate",
                "length", "lossless", "sample_rate"]


def kept_features(bundle_dir):
    """번들의 270개 이름을 순서 그대로. 이 순서가 PCA 열 순서다."""
    path = os.path.join(bundle_dir, "feature_list.json")
    names = json.load(io.open(path, encoding="utf-8"))["features"]
    if len(names) != N_KEPT:
        raise ValueError("feature_list.json 이 {}개다. {}개여야 한다.".format(len(names), N_KEPT))
    return names


# --------------------------------------------------------------------------
# S1.5a  약 2,929 → 389
# --------------------------------------------------------------------------
def json_field(F, section, key, branch):
    """(section, key, branch) → 원본 JSON 안의 접근 경로를 Spark 식으로."""
    node = F.col(section).getField(key)
    if branch is None:                          # plain scalar
        return node
    if isinstance(branch, str):                 # stat-pack: mean / var / dmean2
        return node.getField(branch)
    stat, index = branch                        # list: ("mean", i) 또는 (None, i)
    if stat is not None:
        node = node.getField(stat)
    return node.getItem(index)


def select_389(df):
    """원본 JSON DataFrame → 389 특징 + 메타.

    cov·icov, 통계 6갈래, `beats_position`, `metadata.*`, 문자열은 **select 하지 않으므로**
    자동으로 배제된다. 따로 지우는 코드가 없다.
    """
    from pyspark.sql import functions as F

    feature_cols = [json_field(F, sec, key, br).cast("double").alias(name)
                    for name, sec, key, br, _ in COLUMNS]
    string_cols = [F.col(sec).getField(key).cast("string").alias("{}.{}".format(sec, key))
                   for sec, key in STRING_FEATURES]
    meta_cols = [F.col(c) for c in META_COLUMNS if c in df.columns]
    out = df.select(*meta_cols, *feature_cols, *string_cols)
    got = [c for c in out.columns if c in set(FEATURE_NAMES)]
    if len(got) != N_STRUCTURAL:
        raise ValueError("389 단계 특징 수 {} != {}".format(len(got), N_STRUCTURAL))
    return out


# --------------------------------------------------------------------------
# S1.5b  389 → 270
# --------------------------------------------------------------------------
def select_270(df, bundle_dir):
    """389(또는 이미 270)에서 번들 목록·순서로 정렬해 270개만 남긴다.

    입력이 이미 270 이어도 같은 코드가 돈다. 하는 일은 **순서 보장**이다.
    """
    from pyspark.sql import functions as F

    names = kept_features(bundle_dir)
    have = set(df.columns)
    missing = [n for n in names if n not in have]
    if missing:
        raise ValueError("270 목록의 특징이 입력에 없다: {}".format(missing[:5]))
    passthrough = [c for c in df.columns if c not in set(FEATURE_NAMES)]
    # 이름에 점이 있다(`tonal.key_key`, `lowlevel.gfcc.mean.0`). 백틱 없이 넘기면 중첩 필드로 읽혀
    # UNRESOLVED_COLUMN 이 난다 — --from-raw 첫 클러스터 실행(2026-09-23, S15P21A405-600)에서 실패했다.
    return df.select(*[F.col("`{}`".format(c)) for c in passthrough],
                     *[F.col("`{}`".format(n)) for n in names])


def run(spark, input_path, output_path, bundle_dir, from_raw=False, sample=None):
    reader = spark.read.json if from_raw else spark.read.parquet
    df = reader(input_path)
    if sample:
        df = df.limit(int(sample))
    if from_raw:
        df = select_389(df)
    df = select_270(df, bundle_dir)
    df.write.mode("overwrite").parquet(output_path)
    feature_count = len([c for c in df.columns if c in set(FEATURE_NAMES)])
    return {"rows": df.count(), "columns": len(df.columns), "features": feature_count,
            "from_raw": bool(from_raw)}


def main():
    ap = argparse.ArgumentParser(description="S1.5 특징 선택")
    ap.add_argument("--in", dest="input_path", required=True)
    ap.add_argument("--out", dest="output_path", required=True)
    ap.add_argument("--bundle", required=True, help="serving/<version> 디렉터리")
    ap.add_argument("--from-raw", action="store_true",
                    help="원본 lowlevel JSON 부터 시작한다(약 2,929 → 389 → 270). "
                         "기본은 이미 추출된 parquet 입력(→ 270 순서 정렬만)")
    ap.add_argument("--sample", type=int, default=None)
    args = ap.parse_args()

    from pyspark.sql import SparkSession
    spark = SparkSession.builder.appName("ody-feature-select").getOrCreate()
    try:
        report = run(spark, args.input_path, args.output_path, args.bundle,
                     from_raw=args.from_raw, sample=args.sample)
        print(json.dumps(report, ensure_ascii=False))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
