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

## 런타임 의존성 (2026-09-10 설치) — 두 노드 모두
클러스터에는 numpy·pandas·pyarrow·pip 이 없었다. S2·S3 이 `mapInPandas` 를 쓰므로 없으면 실행되지 않는다.

```bash
sudo apt-get install -y python3-pip python3-numpy python3-pandas
sudo pip3 install --break-system-packages -U pandas pyarrow
python3 -c "import numpy,pandas,pyarrow;print(numpy.__version__,pandas.__version__,pyarrow.__version__)"
```

master-node 와 app-node **둘 다** 해야 한다(실행기가 양쪽에서 뜬다). 설치 결과: numpy 1.26.4, pandas 3.0.5, pyarrow 25.0.1.
apt 의 pandas 2.1.4 로는 안 된다 — Spark 4.2.0 이 `pandas >= 2.2.0` 을 요구한다.

제출 시 `PYSPARK_PYTHON=python3 PYSPARK_DRIVER_PYTHON=python3` 를 준다.

## 제출 (master-node)
아래 명령은 **2026-09-10 에 실제로 `SUCCEEDED` 로 끝난 것**이다(S2·S3). 증거는 `output/spark_run_S2_2026-09-10.json`, `spark_run_S3_2026-09-10.json`.

```bash
sudo -u ubuntu bash ops/verify/cluster.sh
export PYSPARK_PYTHON=python3 PYSPARK_DRIVER_PYTHON=python3
cd /home/ubuntu/stage            # jobs/ 와 bundle/ 을 여기 올려 둔다

# S2 전처리 — 표본 먼저
/opt/spark/bin/spark-submit --master yarn --deploy-mode client \
  --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
  --name ody-S2-sample jobs/preprocess.py \
  --in hdfs:///ody/data/raw_features_extracted --out hdfs:///ody/data/features_pre_sample \
  --bundle /home/ubuntu/stage/bundle --sample 100000

# S2 전처리 — 전수 (349초, 6,617,603행)
/opt/spark/bin/spark-submit --master yarn --deploy-mode client \
  --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
  --name ody-S2-full jobs/preprocess.py \
  --in hdfs:///ody/data/raw_features_extracted --out hdfs:///ody/data/features_pre \
  --bundle /home/ubuntu/stage/bundle

# S3 PCA — 로더를 preprocess.py 에서 import 하므로 --py-files 가 필요하다 (126초)
/opt/spark/bin/spark-submit --master yarn --deploy-mode client \
  --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
  --name ody-S3-full --py-files jobs/preprocess.py jobs/pca.py \
  --in hdfs:///ody/data/features_pre --out hdfs:///ody/data/coords \
  --bundle /home/ubuntu/stage/bundle

yarn application -list -appStates ALL
```

`--bundle` 은 **드라이버가 읽는 로컬 경로**다. 번들 파라미터는 클로저에 실려 실행기로 가므로 `--files` 로 올릴 필요가 없다.

### S1·S4·S5·S6 — `spark/run_cluster_parity.sh` 가 순서대로 제출한다 (S15P21A405-395)

2026-09-17 기준 이 네 잡은 로컬 표본 패리티까지만 확인했고 클러스터 실행 증거가 없다. 스크립트 하나가
입력 업로드 → 제출 → `yarn application -status` → `output/spark_run_S{1,4,5,6}_<날짜>.json` 까지 한다.

```bash
# 1) 로컬(Windows). S5 입력을 만든다 — 기준 구현 exclusion_apply 의 로더로 apply_rules 가 읽는 컬럼 전부를 한 표에
ODY_BUNDLE_BASE=serving/v2.1-pca16 PYTHONUTF8=1 .venv/Scripts/python.exe spark/build_catalog_input.py
#    → work/catalog_input.parquet (base 6,624,399곡)

# 2) master-node 로 올린다 (rsync 없음, scp)
scp -i ~/.ssh/J15A405T.pem data/work/census_all.parquet data/work/catalog_input.parquet ubuntu@j15a405a.p.ssafy.io:/home/ubuntu/stage/work/
scp -r -i ~/.ssh/J15A405T.pem data/serving/v2.2-pca16 ubuntu@j15a405a.p.ssafy.io:/home/ubuntu/stage/serving/

# 3) master-node
bash ~/S15P21A405/data/spark/run_cluster_parity.sh            # S1 S4 S5 S6 전부
bash ~/S15P21A405/data/spark/run_cluster_parity.sh S5 S6      # 일부만
```

| 단계 | 입력 | 출력 | 기대값 (스크립트가 검사) |
|---|---|---|---|
| S1 | `hdfs:///ody/data/census_all` | `manifest_rows` | 7,404,506행 |
| S4 | `coords_v22` (번들 좌표) | `node_paths` | 트리 밖 배정 0 |
| S5 | `catalog_input` (v2.1 base 6,624,399) | `catalog` | 제외 **1,930,196** (v5 dry-run 값) |
| S6 | `catalog` + `coords_v22` + `node_paths` | `bundle_stage` → 로컬 조립 | `check_contract --strict` FAIL 0, `compare_bundle` vs `serving/v2.2-pca16` pass |

S5 base 가 manifest 7,404,506 이 아닌 이유: v5 규칙은 v2.1 번들(R1~R9 v3 통과 662만) 위에서 정의됐고(D18),
잘린 78만 곡의 좌표가 번들에 없다. 누적 2,710,303 은 v3 780,107 + v5 1,930,196 의 합이다.
S4·S6 이 `coords` 아닌 `coords_v22` 를 읽는 이유: 클러스터 재계산 좌표는 최대 1.91e-06 달라 리프 100% 일치를
보장할 수 없다. 좌표 계산 패리티는 S2·S3 실측(1.86e-06)이 따로 증명한다.

```bash
# S1.5 특징 선택 (원본 JSON 에서 시작할 때만. 추출 특징으로 시작하면 이미 270이다) — 클러스터 미실행
spark-submit ... jobs/feature_select.py --from-raw ...

# S7 적재 CSV — HDFS 에서 읽어 HDFS 에 쓴다. 그 뒤 COPY 는 ingest/run_db_load.sh 가 잇는다
spark-submit ... --py-files ingest/build_csv.py jobs/db_load_csv.py   --catalog hdfs:///ody/data/catalog --coords hdfs:///ody/data/coords   --meta hdfs:///ody/data/v2_meta --song-meta hdfs:///ody/data/v2_song_meta   --feats hdfs:///ody/data/v2_feats hdfs:///ody/data/v2_feats_pilot   --out hdfs:///ody/data/ingest_csv --expect-rows 4694202   --report output/spark_run_S7_YYYY-MM-DD.json
```

## S7 — 파이프라인 끝에서 DB 까지

`ingest/run_db_load.sh` 가 네 단계를 잇는다: **spark-submit → `hdfs dfs -getmerge` + 헤더 → app-node 로 scp → `load_postgres.sh`(COPY)**.

```bash
# master-node 에서. --apply 가 없으면 CSV 전송까지만 하고 멈춘다
ODY_MUSIC_TABLE=music_v2 ODY_LINK_TABLE=music_genre_v2   bash ingest/run_db_load.sh --expect-rows 4694202 --apply
```

**JDBC 로 바로 INSERT 하지 않는다.** PostgreSQL 5432 는 host port 가 없고 `ody-internal` 도커
네트워크에만 열려 있어(`docs/infra/SECURITY.md`) YARN executor 가 붙을 경로가 없다. 그리고 `COPY` 는
662만행 **66초** 실측인데 JDBC 배치는 분 단위다. 파일로 내보내고 서버가 빨아들이는 쪽이 맞다.

### 선행 조건 — HDFS 에 있어야 하는 것
| 경로 | 무엇 | 없으면 |
|---|---|---|
| `/ody/data/catalog` | S5 산출(`excluded` 포함) | 필수 |
| `/ody/data/coords` | S3 산출 `mbid` + `pc1..pc16` | 필수 |
| `/ody/data/v2_feats`·`v2_feats_pilot` | `rhythm.bpm`. **둘 다** 올려야 한다(D16) | 필수 |
| `/ody/data/v2_meta` | `album`·`release_year`·`albumid`(D17 재패스) | 없으면 세 컬럼이 빈 값 |
| `/ody/data/v2_song_meta` | 장르 코드 `gnr` | 없으면 `music_genre` 가 비어 나온다 |

`v2_meta`·`v2_song_meta` 는 로컬 `work/` 에만 있으므로 `hdfs dfs -put` 으로 먼저 올린다.

### 헤더를 잡이 쓰지 않는 이유
파트 파일마다 헤더가 들어가면 `COPY` 가 그 줄을 데이터로 읽는다. 잡은 헤더 없이 쓰고,
`run_db_load.sh` 가 `getmerge` 뒤에 한 번만 붙인다(`COPY ... HEADER true` 와 짝).

단계 순서: `manifest_rows.py`(S1) → `feature_select.py`(S1.5) → `preprocess.py`(S2) → `pca.py`(S3) → `tree_assign.py`(S4) → `catalog_rules.py`(S5) → `artifact_export.py`(S6) → `db_load_csv.py`(S7). 각 잡은 `--sample N` 으로 표본 실행 후 전곡.

곡 수를 줄이는 잡은 **S1 과 S5 둘**이다(제출본 2,946만 → 곡 740만 → 662만). 차원을 줄이는 잡은 S1.5a·S1.5b·S3 이다.

S2·S3 은 `mapInPandas` 로 실행기에서 numpy 연산을 한다. 270컬럼·4,320항 표현식 트리를 피하고 기준 구현과 같은 함수를 쓰기 위해서다. 재학습은 없다(규칙 3).

⚠️ 특징 이름은 `lowlevel.gfcc.mean.0` 처럼 점을 포함한다. `select` 에 그대로 넘기면 Spark 가 중첩 필드로 해석해 `UNRESOLVED_COLUMN` 으로 실패한다. 백틱으로 감싸야 한다(`preprocess.quoted`).

S4 는 깊이 한 단계마다 같은 노드의 행을 모아 계산한다. S5 는 행을 지우지 않고 `excluded`·`excluded_reason[]`·`flag_*` 로 표시하며 임계값은 `pipeline/exclusion_rules.json` 에서만 읽는다. S6 은 세 표를 모두 `mbid` 오름차순으로 정렬해 서빙의 정렬 불변식을 성립시키고, 동결 파일 7개는 복사만 한다.

`--prev` 해시 대조는 Spark 산출물에 적용할 수 없다(바이트가 같을 수 없다). 대신 `compare_bundle` 내용 대조를 쓴다. 근거는 스펙 20 의 S6 절.

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
