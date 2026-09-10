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
| S1 대표행 선택 | `census_all.parquet` 제출본 29,460,584 | `manifest_rows/` **7,404,506 행** | mbid 집합 == v2 manifest. 규칙은 아래 별도 절. 잡은 `spark/jobs/manifest_rows.py` |
| S2 전처리 | manifest_rows + feature_list(skew) + model_bundle(delta_f, impute_median, scaler, clip) | `features_pre/` 270 f32 | 표본 10만: 최대 절대 오차 < 1e-4 vs 기존 파이프라인 |
| S3 PCA | features_pre + pca_mean, pca_components | `coords/` pc1..pc16 | **전곡** 최대 절대 오차 < 1e-4 vs `coords_v2.parquet` |
| S4 트리 배정 | coords + split_axes.npz | `node_paths/` leaf_id | 리프 일치 100% (경계값 동률은 v2 규칙과 같은 부호 처리) |
| S5 카탈로그·규칙 | manifest_rows + titles + canonical + 규칙 R1~R9(+길이 v4, flag_instrumental) | `catalog/` (계약 스키마) | `excluded` 집합 == v2.2 카탈로그, 규칙별 적중 수 동일 |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | `check_contract.py --strict --prev` 통과 |

## S1 대표행 선택 — 제출본 2,946만 → 곡 740만

**곡 수를 줄이는 단계는 파이프라인에 둘이다.** 이것이 첫 번째이고 S5 카탈로그 규칙이 두 번째다. 차원을 줄이는 단계(S1.5a, S1.5b, S3)와는 별개다.

```text
census 제출본 29,460,584
  → 1. 코호트 필터            지문 9개 밖은 후보 아님
  → 2~5. MBID 당 1행 선택
  → 곡 7,404,506
  → (S5 가 R1~R9 로 780,107 더 자름)  →  6,624,399
```

### 선택 규칙 (완전 결정적)
```text
1. 코호트 9개 지문의 제출본만 후보
2. lossless 우선
3. sample_rate == 44100 우선 (결측은 뒤로)
4. 지문 규모 순위  74 > 72 > 73 > 76 > 99 > 71 > 101 > 103 > 87
5. part 오름차순 → offset 오름차순      최종 동률 제거자
```

원본은 `dmadkr/scripts/build_v2_manifest.py` 이고 `np.lexsort` 로 같은 순서를 만든다. Spark 는 `Window.partitionBy(mbid).orderBy(...)` + `row_number() == 1` 로 재현한다.

### 코호트 판정은 네 문자열 일치다
census 에 `fingerprint` 컬럼이 **없다.** `essentia`, `essentia_git_sha`, `essentia_build_sha`, `extractor` **네 값이 모두** 정의와 같을 때 그 지문으로 본다. 단일 컬럼 비교로 착각하면 결과가 달라진다.

| 무엇 | 어디 |
|---|---|
지문 정의 (네 문자열) | `pipeline/version_census_fingerprints.csv` |
코호트 목록 | `pipeline/v2_cohort_decision.json` 의 `cohort_fingerprints` |
코호트 근거 | `CONFIRMED_BY_GATE_V2` |

코호트 지문은 `71, 72, 73, 74, 76, 87, 99, 101, 103` 이다. 규모 순위(`FP_RANK`)와 집합이 같아야 하고 잡이 시작할 때 검사한다.

### `is_fit_sample` 은 재현하지 않는다
원본은 `numpy.default_rng(42)` 로 층(part × lossless)마다 `rng.choice` 를 불러 fit 표본 100만 곡을 뽑는다. **호출 순서에 의존하므로 Spark 로 같은 결과를 낼 수 없다.**

다만 이것은 fit 산물이고 규칙 3 상 재계산 대상이 아니다. S2·S3 은 동결 파라미터를 적용만 하므로 fit 표본이 필요 없다. Spark S1 출력은 `mbid, part, offset, fingerprint, lossless, sample_rate` 여섯 컬럼이다. 필요하면 기존 `work/v2_manifest.parquet` 에서 조인한다.

### 패리티 기준
- 행 수 7,404,506, `mbid` 중복 0.
- 실제 census 표본 300 mbid 에서 고른 `(part, offset, fingerprint)` 가 `v2_manifest.parquet` 과 같다. `tests/test_manifest_rows.py` 가 검사하며 2026-09-10 에 통과했다.

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
