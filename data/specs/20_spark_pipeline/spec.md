# 20 Spark 파이프라인 이식 — spec

상태 ⬜ · 목표일 09-10~11 (원본 적재 잡은 09-12 가동, 완주는 배포 후 허용) · 결정 D6(패리티 트랙)

## 목적
`Raw → Feature Selection → Preprocessing → PCA → Catalog → Serving Artifact` 를 Hadoop/Spark 잡으로 만들고, **현재 아티팩트(v2.2)를 비트 수준 가깝게 재현**한다. 재학습은 하지 않는다. 학습된 파라미터(`model_bundle.npz`, `split_axes.npz`, `feature_list.json`, `exclusion_rules.json`)를 적용만 한다.

## 실행 환경 요건 (D8 — 프로젝트 요건, 협상 대상 아님)
**Spark 와 Hadoop 을 모두 실제로 사용해야 한다.** 이 스펙에서 그 뜻은:

| 구성요소 | 무엇으로 충족하나 |
|---|---|
| HDFS | 잡의 **입력과 출력이 `hdfs:///` 경로**다. 로컬 파일 경로로 읽고 쓰는 실행은 충족하지 않는다 |
| YARN | `spark-submit --master yarn` 으로 제출한다. ResourceManager 가 executor 컨테이너를 띄운다 |
| Spark | S2~S6 잡 본체 |

`pyspark local[8]` 로컬 실행은 **개발·디버그 용도로만 허용**한다. HDFS 도 YARN 도 쓰지 않으므로 **완료 증거가 될 수 없다**. 표본 패리티를 로컬에서 먼저 맞추는 것은 좋지만, 그 결과만으로 작업을 완료로 표시하지 않는다.

일정이 밀려도 **클러스터 실행은 자르지 않는다**(`data/AGENTS.md` 규칙 10, `docs/plan_release1.md` §4). 자르는 것은 원본 630GB 적재(S0)와 전곡 처리 범위이지, 실행 환경이 아니다.

### 남길 증거
`output/spark_run_<단계>_<날짜>.json` 에 잡마다 기록한다.
```json
{ "stage": "S2", "submitted": "spark-submit --master yarn ...",
  "yarn_application_id": "application_<epoch>_<seq>", "final_status": "SUCCEEDED",
  "input_path": "hdfs:///ody/data/raw_features_extracted", "input_rows": 0,
  "output_path": "hdfs:///ody/data/features_pre", "output_rows": 0,
  "executors": 2, "executor_memory": "4g", "executor_cores": 2, "driver_memory": "2g",
  "duration_s": 0, "hdfs_du": "<hdfs dfs -du -h 출력>" }
```
수집 명령은 `spark/README.md` 참조.

## 단계와 계약
| 단계 | 입력 | 출력 (HDFS Parquet) | 패리티 기준 |
|---|---|---|---|
| S0 원본 적재 | `lowlevel/*.tar.zst` 30파트 | `raw_features/part=NN/` : `mbid, offset, part, fingerprint, codec, bit_rate, length, lossless, sample_rate, f_000..f_269(float32), title, artist` | 행 수 = 전수조사 `census_all.parquet` 의 코호트 행 수; 표본 1만 행 값 == 기존 추출 Parquet |
| S1 대표행 선택 | raw_features + `work/v2_manifest.parquet` 규칙(지문→lossless→44100→규모→part,offset) | `manifest_rows/` 7,404,506 행 | mbid 집합 == v2 manifest |
| S2 전처리 | manifest_rows + feature_list(skew) + model_bundle(delta_f, impute_median, scaler, clip) | `features_pre/` 270 f32 | 표본 10만: 최대 절대 오차 < 1e-4 vs 기존 파이프라인 |
| S3 PCA | features_pre + pca_mean, pca_components | `coords/` pc1..pc16 | **전곡** 최대 절대 오차 < 1e-4 vs `coords_v2.parquet` |
| S4 트리 배정 | coords + split_axes.npz | `node_paths/` leaf_id | 리프 일치 100% (경계값 동률은 v2 규칙과 같은 부호 처리) |
| S5 카탈로그·규칙 | manifest_rows + coords + titles + canonical + 태그·감사 + 규칙 R1~R9 | `catalog/` 전 행 + `excluded`·`excluded_reason[]`·`dup_group_id`·`is_representative`·`flag_*` | 제외 780,107, 규칙별 적중 수 동일. 규칙은 아래 별도 절. 잡은 `spark/jobs/catalog_rules.py` |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | `check_contract.py --strict --prev` 통과 |

## S5 카탈로그 제외 규칙 — 곡 740만 → 662만

**곡 수를 줄이는 두 번째이자 마지막 단계다.** 첫 번째는 S1 대표행 선택이다.

```text
S1 대표행 7,404,506
  → 규칙 R1~R9 적용        제외 780,107 (10.54%)
  → 남는 곡 6,624,399
```

행을 지우지 않는다. 모든 행을 그대로 내고 `excluded`, `excluded_reason[]`, `flag_*` 로 표시한다(`data/AGENTS.md` 규칙 2). 임계값은 `pipeline/exclusion_rules.json`(v3)에서만 읽고 잡 코드에 숫자를 적지 않는다(규칙 9). 테스트가 하드코딩 여부를 검사한다.

### 규칙별 적중 (원본 기록, `dmadkr/output/exclusion_report.json`)
| 규칙 | 적중 | 단독 적중 | 무엇을 자르나 |
|---|---:|---:|---|
| R1_length | 113,841 | 110,613 | 30초 미만. 20분 초과(태그 있는 비예외). 미태그는 30분 초과 |
| R2_nonmusic | 10,014 | 8,734 | 비음악 키워드 9개 적중 |
| R3_no_key | 10,976 | 10,846 | 제목·아티스트 원문이 둘 다 빈 곡 |
| R4_cohort | 0 | 0 | 코호트 밖 지문. S1 이 이미 걸러 0 이 정상(명시용) |
| R5_dup_canonical | 241,660 | 240,646 | 같은 canonical 의 가까운 중복 |
| R6_dup_version | 407,026 | 405,682 | 같은 제목·아티스트의 가까운 버전 중복 |
| R7_samplerate | 0 | 0 | **꺼짐**. `flag_low_sr` 만 만든다 |
| R8_silence | 116 | 78 | 하위 분위 음량 + 무음률 높음 |
| R9_corrupt | 0 | 0 | **꺼짐**. `flag_clipped` 만 만든다 |

R5·R6 은 거리 보호가 있다. 대표와 좌표 거리가 `protect_dist`(4.0) 를 넘는 멤버는 제목이 같아도 접지 않는다. 근거는 같은 녹음의 제출본 거리 p90 이 5.18 이고 제목만 같은 묶음의 멤버 거리 median 이 5.34 라는 감사 A6·A7 이다.

### 분산 처리로 바뀐 것
| 무엇 | 원본 | Spark |
|---|---|---|
| 묶음 대표 선정 | `sort_values` + `drop_duplicates` | `Window.partitionBy(묶음).orderBy(...)` + `row_number() == 1` |
| 대표와의 거리 | 대표 행을 색인해 `np.linalg.norm` | 같은 창의 `first(pc_i)` 로 대표 좌표를 실어 조인 없이 계산 |
| 제목 정규화 | `catalog_audit.r6_key` | 같은 정규식을 잡에 복제(실행기에서 pandas import 회피). 테스트가 두 구현의 일치를 검사 |

### 기준 출력과 값이 다른 두 컬럼
1. `dup_group_id` — 원본은 `pandas.factorize` 의 등장 순서 정수다. 분산 환경에서 재현할 수 없어 묶음 키의 `xxhash64` 를 쓴다. **묶음 분할은 같고 정수 값만 다르다.** 테스트는 분할을 비교한다.
2. `rules_hash` — 원본 `7854e999ee3f14d1` 은 CRLF 사본의 바이트 해시다. 저장소는 LF 라 내용이 같아도 해시가 다르다. 그래서 정렬된 JSON 을 해시해 개행에 무관하게 만든다.

### 패리티 기준
`work/catalog_v2.parquet` 이 기준이다. `tests/test_catalog_rules.py` 13건이 2026-09-10 에 통과했다.

| 무엇 | 어떻게 | 결과 |
|---|---|---|
| 행 단위 규칙 R2·R3·R4·R7·R9, R1 짧은 곡 | 표본 8,000행 전수 비교 | 불일치 0 |
| R1 긴 곡 | 20분 초과 29,966행 중 150행 + 실제 `genres_raw` 태그 | 불일치 0 |
| R8 | 실제 특징 3컬럼으로 재계산 | 특징이 있는 113곡 전부 일치, 남는 3곡은 특징 없음 |
| R5 | canonical 묶음 200개 | 대표가 접힌 사례 0. 보호된 멤버 204쌍 모두 거리 > 4.0 |
| R6 | 묶음 200개(2곡 이상 묶음 589,543개에서 추출) | 묶음 분할·대표 선정 완전 일치 |
| 제목 정규화 | 실제 제목 5,000개 | `catalog_audit.r6_key` 와 완전 일치 |

### R8 분위값은 입력이 복구된 뒤에 검증한다
R8 은 전곡 `average_loudness` 의 하위 0.1 퍼센타일이 필요하다. 현재 `v2_feats` 가 28/30 파트라 28파트로 계산하면 8.011e-05 이고 원본 기록은 8.517e-05 다. 데이터가 빠져서 생긴 차이다. 그래서 패리티 테스트는 기록값을 넣어 판정만 검증하고, 분위값 자체의 패리티는 열린 질문 Q7(파트 재추출)이 정해진 뒤로 남긴다.

### 이식하지 않는 것
dry-run 리포트(md/json), 브릿지 풀 Hit@10 재검증, 서빙 번들 내보내기. 앞의 둘은 fit·QA 산물이고(규칙 3) 마지막은 S6 `artifact_export.py` 담당이다.

## 수용 기준
- AC0 **클러스터 실행** — S2 와 S3 이 최소 1회씩 `spark-submit --master yarn` 으로 제출돼 `SUCCEEDED` 로 끝나고, 입력·출력이 `hdfs:///` 경로다. `output/spark_run_S2_*.json`, `spark_run_S3_*.json` 에 YARN application id·최종 상태·입출력 경로·행 수가 남는다. 로컬 `local[*]` 실행 기록은 이 기준을 충족하지 않는다. **컷 대상 아님.**
- AC1 S2~S6 이 **기존 추출 Parquet 를 입력으로** 끝까지 돌고 패리티 기준 전부 통과 (`tests/test_spark_parity.py`, 표본 + 전곡 요약).
- AC2 S0 잡이 클러스터에서 최소 1파트 완주하고 표본 값 일치. 30파트 완주는 배포 후 허용(D6). **S0 자체는 컷 1번**이며, 잘려도 AC0 은 S2·S3 으로 충족된다.
- AC3 각 잡은 멱등(같은 입력 → 같은 출력 해시), 파티션 단위 재시작 가능.
- AC4 실행 문서 `spark/README.md`: 제출 명령, 자원(executor 수·메모리), 소요 시간, **증거 수집 절차** 기록.
- AC5 HDFS 에 입력이 올라가 있고 행 수가 로컬 원본과 같다: `hdfs:///ody/data/raw_features_extracted`. **2026-09-10 실측 6,617,603행(파일 28개, 8.7G)** — 계획서의 7,404,506 은 틀린 수치였다(아래 참조).

### 입력 데이터가 완전하지 않다 (2026-09-10 확인)
`work/v2_feats` 는 30개 파트 중 **28개**다. `part10`, `part24` 가 빠져 있다.

| 집합 | 행 수 |
|---|---|
| manifest (S1 대표행) | 7,404,506 |
| `coords_v2.parquet` | 6,624,399 |
| v2_feats (28파트) | 6,617,603 |
| coords ∩ feats | 5,891,253 |
| coords 에만 있음 (특징 없음) | 733,146 |
| feats 에만 있음 (제외된 곡) | 726,350 |

검산: 6,617,603 = 5,891,253 + 726,350. 빠진 786,903 = coords 733,146 + 제외곡 53,757. manifest 7,404,506 과 제외 780,107 에 정확히 맞는다.

**결과: 현재 입력으로는 S3 의 전곡 패리티(위 표)를 검증할 수 없다.** coords 의 11.1% 에 특징이 없다.
- 교집합 5,891,253곡(coords 의 88.9%)으로는 검증할 수 있다. 그 범위에서는 기준을 그대로 적용한다.
- 원본 `acousticbrainz-lowlevel-json-20220623-{10,24}.tar.zst` 는 로컬에 있고 추출기(`dmadkr/scripts/extract_v2_features.py`)도 있다. 파트당 약 5분이므로 재추출하면 전곡 검증이 가능해진다.
- 재추출 여부는 결정 대기(열린 질문 Q7). 결정 전까지 S3 패리티 범위는 **교집합**으로 읽는다.

우선순위: 일정이 부족하면 **AC0 → AC1(표본) → AC1(전곡) → AC2** 순으로 확보한다. AC0 없이 AC1 만 로컬에서 채우는 것은 요건 미충족이다.

## 비범위
재학습(M1·scaler·PCA·트리), ANN 인덱스 생성, 스트리밍.
