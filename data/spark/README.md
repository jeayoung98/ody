# spark/ — Spark 이식 (spec 20, 패리티 트랙)

numpy 기준 구현(`pipeline/`, `scripts/korean_common.py`, `scripts/v2_build_map_tree.py` 규칙)과 같은 결과를 Spark on YARN 에서 내는 것이 목표다.
서빙 선행조건이 아니다(D6). 패리티 기준: 좌표 오차 < 1e-4, 리프 일치 100%, 제외 집합 동일.

## 클러스터 (docs/infra/STATUS.md, HANDOVER_TEAM §5 기준)
노드 2대 × 4 vCPU / 15GiB, YARN 총 12GB·6 vcores, Spark 4.2.0 on YARN(master-node client). S0 원본 630GB 적재는 1차 범위 밖. 입력은 추출 특징 8.8GB(`hdfs:///ody/data/raw_features_extracted`).

## 자원 설정
입력 파티션 ≈ 100(90MB), executor 2 × 4GB × 2 cores, driver 2GB. `collect()`/`toPandas()` 금지. 결과는 HDFS parquet. 팀 규칙(`docs/infra/SPARK_PIPELINE.md`): sample → schema/row 검증 → full → publish.

## 제출 (master-node)
```bash
sudo -u ubuntu bash ops/verify/cluster.sh
spark-submit --master yarn --deploy-mode client --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
  spark/jobs/preprocess.py --in hdfs:///ody/data/raw_features_extracted --out hdfs:///ody/data/features_pre --sample 100000
yarn application -list -all
```
단계 순서: `preprocess.py`(S2) → `pca.py`(S3) → `tree_assign.py`(S4) → `catalog_rules.py`(S5) → `artifact_export.py`(S6). 각 잡은 `--sample N` 으로 표본 실행 후 전곡.

## 패리티 검증
로컬 `pyspark`(local[8]) 표본 10만 행 → `tests/test_spark_parity.py` 가 numpy 기준과 비교. 전곡은 클러스터 결과 parquet 요약 통계(최대 오차·불일치 수)만 검사.
