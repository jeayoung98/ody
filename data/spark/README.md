# spark/ — Spark 이식 (spec 20, 패리티 트랙)

numpy 기준 구현(`pipeline/`, `scripts/korean_common.py`, `scripts/v2_build_map_tree.py` 규칙)과 같은 결과를 Spark on YARN 에서 내는 것이 목표다.
서빙 선행조건이 아니다(D6). 패리티 기준: 좌표 오차 < 1e-4, 리프 일치 100%, 제외 집합 동일.

**D8 — Spark 와 Hadoop 을 모두 실제로 써야 한다(프로젝트 요건).** 잡의 입출력은 `hdfs:///` 경로이고 제출은 `spark-submit --master yarn` 이다. 로컬 `pyspark local[8]` 은 수치를 먼저 맞추는 개발용이며 **완료 증거가 아니다**(스펙 20 AC0). 일정이 밀려도 클러스터 실행은 자르지 않는다.

## 클러스터 (2026-09-10 실측)
| 항목 | 값 |
|---|---|
| master-node | `j15a405a.p.ssafy.io` — **이름 주의**, `j15a405` 쪽이 app-node 다 |
| app-node | `j15a405.p.ssafy.io` |
| 접속 | `ssh -i ~/.ssh/J15A405T.pem ubuntu@j15a405a.p.ssafy.io` |
| HDFS | 용량 617.86 GB, 여유 593.80 GB, DataNode 2, replication 2 |
| YARN | NodeManager 2, 총 12GB·6 vcores |
| Spark | `/opt/spark/bin/spark-submit` — PATH 에 없으니 전체 경로로 부른다. Java 21 |
| 스테이징 | `/home/ubuntu/stage` — `/data` 는 root 소유라 못 쓴다. 로컬 디스크 297GB 여유 |

S0 원본 630GB 적재는 1차 범위 밖. 입력은 추출 특징 `hdfs:///ody/data/raw_features_extracted`.

## 자원 설정
입력 파티션 ≈ 100(90MB), executor 2 × 4GB × 2 cores, driver 2GB. `collect()`/`toPandas()` 금지. 결과는 HDFS parquet. 팀 규칙(`docs/infra/SPARK_PIPELINE.md`): sample → schema/row 검증 → full → publish.

## 제출 (master-node)
```bash
sudo -u ubuntu bash ops/verify/cluster.sh
spark-submit --master yarn --deploy-mode client --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
  spark/jobs/preprocess.py --in hdfs:///ody/data/raw_features_extracted --out hdfs:///ody/data/features_pre --sample 100000
yarn application -list -all
```
단계 순서: `feature_select.py`(S1.5) → `preprocess.py`(S2) → `pca.py`(S3) → `tree_assign.py`(S4) → `catalog_rules.py`(S5) → `artifact_export.py`(S6). 각 잡은 `--sample N` 으로 표본 실행 후 전곡.

차원 축소 사슬은 **약 2,929 → 389 → 270 → 16** 이다. 앞 두 컷이 `feature_select.py`, 마지막이 `pca.py` 다.
`work/v2_feats` 는 270 지점 체크포인트이므로 그 입력으로는 `feature_select.py` 가 순서만 맞춘다.
원본 JSON 부터 돌리려면 `--from-raw` 를 준다(S0 필요, 1차 범위 밖).

## HDFS 적재 (T2, 컷 대상 아님) — 2026-09-10 완료
```bash
# 로컬(Windows) → master-node. 로컬에 rsync 가 없어 파일 단위 scp 로 한다.
scp -i ~/.ssh/J15A405T.pem data/work/v2_feats/partN.parquet \
    ubuntu@j15a405a.p.ssafy.io:/home/ubuntu/stage/v2_feats/
# master-node → HDFS
hdfs dfs -mkdir -p /ody/data/raw_features_extracted
hdfs dfs -put -f /home/ubuntu/stage/v2_feats/*.parquet /ody/data/raw_features_extracted/
hdfs dfs -count /ody/data/raw_features_extracted
hdfs dfs -du -s -h /ody/data/raw_features_extracted
```
결과: 파일 28개, 9,361,101,797 바이트(8.7G, 복제 포함 17.4G). 전송 2분 11초(약 70MB/s).
증거는 `output/hdfs_ingest_2026-09-10.json`.

### 입력이 완전하지 않다 (중요)
`v2_feats` 는 **30개 파트 중 28개**다. `part10` 과 `part24` 가 빠져 있다.

| 집합 | 행 수 |
|---|---|
| manifest (S1 대표행) | 7,404,506 |
| coords_v2.parquet | 6,624,399 |
| v2_feats (28파트) | 6,617,603 |
| coords ∩ feats | 5,891,253 |
| coords 에만 있음 | 733,146 |

따라서 **이 입력만으로는 전곡 좌표 패리티를 검증할 수 없다.** coords 의 11.1% 에 해당하는 특징이 없다.
교집합 5,891,253곡(coords 의 88.9%)에 대해서는 검증할 수 있다.

원본 `C:/abz_data/lowlevel/acousticbrainz-lowlevel-json-20220623-{10,24}.tar.zst` 는 로컬에 있고,
추출기는 `dmadkr/scripts/extract_v2_features.py` 다(파트당 약 5분). 재추출 여부는 결정 대기 중이다.

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
