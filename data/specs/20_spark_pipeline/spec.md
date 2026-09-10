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
| S5 카탈로그·규칙 | manifest_rows + titles + canonical + 규칙 R1~R9(+길이 v4, flag_instrumental) | `catalog/` (계약 스키마) | `excluded` 집합 == v2.2 카탈로그, 규칙별 적중 수 동일 |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | 원래 문장: `check_contract.py --strict --prev` 통과. **`--prev` 는 적용 불가 — 아래 S6 절 참조.** 대체 기준은 `--strict` 통과 + 내용 대조. 잡은 `spark/jobs/artifact_export.py` |

## S6 serving 번들 내보내기 — 파이프라인의 끝

```text
S5 카탈로그 + S3 좌표 + S4 말단 노드
  → Spark      excluded=false 만 남기고 세 표를 mbid 오름차순으로 정렬해 내보낸다
  → 드라이버   동결 파일 7개 복사 + manifest.json 생산
  → serving/<v>/  계약 v1 파일 10개
```

### 왜 mbid 오름차순인가 — 정렬 불변식
서빙은 **`coords` 의 i번째 행 = 카탈로그에서 `excluded == False` 인 i번째 행**이라는 불변식에 의존한다(`retrieval/artifact.py`). 이 하나로 좌표·메타데이터·kNN 그래프를 정수 색인 하나로 다룬다.

분산 환경에서 "입력 파일에 적힌 순서"는 보장되지 않는다. 그래서 S6 은 세 표를 **같은 키로 명시적으로 정렬**해 불변식을 성립시킨다. `mbid` 는 유일하므로 정렬이 완전히 결정적이다.

같은 이유로 이 잡은 **카탈로그도 다시 쓴다**. 좌표만 정렬하고 카탈로그를 입력 그대로 두면 불변식이 깨진다.

### 동결 파일은 만들지 않고 복사한다 (규칙 3)
`model_bundle.npz`, `feature_list.json`, `fit_manifest.json`, `postprocess_rules.json`, `map_tree/tree.json`, `map_tree/split_axes.npz`, `map_tree/quality_by_depth.csv` 일곱 개다. `promotion_gate` 도 이전 manifest 기록을 그대로 싣는다. 게이트를 다시 돌리는 것은 별도 결정이다. 번들 승격과 `CURRENT.json` 교체는 이 잡의 범위가 아니다(사람 승인).

### `--prev` 기준은 적용할 수 없다 (규칙 1 — 원래 문장을 지우지 않고 남긴다)
위 표의 원래 완료 조건은 `check_contract.py --strict --prev` 통과였다. 그런데 `--prev` 는 `coords_v2.parquet`·`node_paths_v2.parquet`·`split_axes.npz`·`model_bundle.npz` 의 sha256 이 이전 번들과 **바이트 단위로** 같기를 요구한다(minor 버전 규칙). **Spark 가 쓴 parquet 는 numpy 파이프라인이 쓴 parquet 와 바이트가 같을 수 없다** — 압축기·행 그룹 크기·정렬이 다르다. 즉 이 기준은 Spark 산출물에 대해 통과가 원리적으로 불가능하다.

그래서 판정 기준을 다음 둘로 **새로 등록**한다. 원래 문장은 위 표에 그대로 남긴다.

| 새 기준 | 무엇을 본다 |
|---|---|
| S6-AC-a | `check_contract.py <번들> --strict` 가 FAIL 0 으로 끝난다 |
| S6-AC-b | 기존 번들과 **내용 대조**(`compare_bundle`): mbid 집합 동일, 좌표 최대 절대 오차 < 1e-4, 말단 노드 일치 100% |

`--prev` 해시 대조는 **같은 도구가 만든 minor 승격**(v2.1 → v2.2)에서는 그대로 유효하다. 폐기가 아니라 적용 범위를 좁힌 것이다.

### 전수 조립 실측 (2026-09-10)
`output/artifact_export_2026-09-10.json`. 임시 디렉터리에 조립했고 **승격은 하지 않았다**.

| 항목 | 값 |
|---|---|
| 곡 수 | 6,624,399 |
| 계약 검사 `--strict` | **FAIL 0, WARN 0** |
| 내용 대조 mbid 집합 | 동일 |
| 좌표 최대 절대 오차 | 0.0 |
| 말단 노드 일치 | 6,624,399 / 6,624,399 = **100%** |
| 소요 | 107초 (정렬·쓰기 45초, 계약 검사 11초, 대조 51초) |

⚠️ **이 실측이 무엇을 증명하고 무엇을 증명하지 않는가.** 좌표를 기존 번들에서 가져와 정렬·조립했으므로 오차 0 은 당연하다. 이 실측이 증명하는 것은 **조립 경로**(정렬, 동결 파일 복사, manifest 해시, 계약 준수)다. 좌표 계산의 정확성은 S2·S3 패리티(최대 오차 1.86e-06), 말단 노드는 S4 패리티(100%)가 증명한다. 클러스터에서 S2~S6 을 이어 돌린 뒤 같은 대조를 다시 해야 AC1 이 채워진다.

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
