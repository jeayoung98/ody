# spark/ — Spark 이식 (spec 20, 패리티 트랙)

numpy 기준 구현(`pipeline/`, `scripts/korean_common.py`, `scripts/v2_build_map_tree.py` 규칙)과 같은 결과를 Spark on YARN 에서 내는 것이 목표다.
서빙 선행조건이 아니다(D6). 패리티 기준: 좌표 오차 < 1e-4, 리프 일치 100%, 제외 집합 동일.

**D8 — Spark 와 Hadoop 을 모두 실제로 써야 한다(프로젝트 요건).** 잡의 입출력은 `hdfs:///` 경로이고 제출은 `spark-submit --master yarn` 이다. 로컬 `pyspark local[8]` 은 수치를 먼저 맞추는 개발용이며 **완료 증거가 아니다**(스펙 20 AC0). 일정이 밀려도 클러스터 실행은 자르지 않는다.

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

## HDFS 적재 (T2, 컷 대상 아님)
```bash
# 로컬(Windows) → master-node
scp -r data/work/v2_feats ubuntu@master-node:/data/stage/
# master-node → HDFS
hdfs dfs -mkdir -p /ody/data
hdfs dfs -put /data/stage/v2_feats /ody/data/raw_features_extracted
hdfs dfs -du -h /ody/data
hdfs dfs -count /ody/data/raw_features_extracted
```
행 수 7,404,506 을 확인한다(스펙 20 AC5).

## 증거 수집 (스펙 20 AC0)
잡마다 아래를 모아 `output/spark_run_<단계>_<날짜>.json` 에 넣는다. 이것이 Hadoop·Spark 를 실제로 썼다는 기록이다.

```bash
# 1) 제출 — application id 가 stdout 에 찍힌다
spark-submit --master yarn --deploy-mode client \
  --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
  spark/jobs/preprocess.py --in hdfs:///ody/data/raw_features_extracted --out hdfs:///ody/data/features_pre

# 2) 최종 상태 (FinalStatus 가 SUCCEEDED 여야 한다)
yarn application -list -appStates ALL | grep application_
yarn application -status application_<epoch>_<seq>

# 3) 출력 확인
hdfs dfs -du -h /ody/data/features_pre
hdfs dfs -count /ody/data/features_pre
```

`--master local[*]` 로 돌린 기록은 HDFS 도 YARN 도 쓰지 않으므로 증거가 되지 않는다.

## 패리티 검증
로컬 `pyspark`(local[8]) 표본 10만 행 → `tests/test_spark_parity.py` 가 numpy 기준과 비교. **여기까지는 개발 단계다.** 같은 잡을 클러스터에 제출해 다시 확인해야 완료다. 전곡은 클러스터 결과 parquet 요약 통계(최대 오차·불일치 수)만 검사.
