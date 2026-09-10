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
| S4 트리 배정 | coords + `map_tree/tree.json` + `split_axes.npz` | `node_paths/` `mbid` + `leaf_id` + `node_d1` + `node_d2` | 말단 노드 일치 100%. 표본 5,000곡 실측 완료. 잡은 `spark/jobs/tree_assign.py` |
| S5 카탈로그·규칙 | manifest_rows + titles + canonical + 규칙 R1~R9(+길이 v4, flag_instrumental) | `catalog/` (계약 스키마) | `excluded` 집합 == v2.2 카탈로그, 규칙별 적중 수 동일 |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | `check_contract.py --strict --prev` 통과 |

## S4 트리 배정 — 16차원 좌표에서 말단 노드 4,096개

트리는 학습된 산물이다(`map_tree/tree.json`, `split_axes.npz`, 2026-09-03 사용자 승인). 이 잡은 다시 학습하지 않고 노드별 값을 적용한다(규칙 3). 테스트가 소스에 고유분해(`eigh`)가 없는지도 검사한다.

```text
root 에서 시작해 깊이 6 까지 한 칸씩
  1. proj = (x - mean_<id>) @ axes_<id>.T          2차원으로 내린다
  2. q = (proj0 >= med0) * 2 + (proj1 >= med1)     사분면 0~3
  3. 다음 노드는 "<id>.<q>"
```

같은 값일 때는 `>=` 로 가른다. **원본이 `>=` 라서 그렇다.** 이 부등호가 뒤집히면 경계에 놓인 곡의 말단 노드가 달라진다.

`node_d1`·`node_d2` 는 `leaf_id` 의 앞 두 단계·세 단계다(`root.2.3.0.3.1.2` → `root.2`, `root.2.3`). 카탈로그와 같은 형식이다.

### 한 행씩 내려가지 않는다
깊이 한 단계마다 **같은 노드에 속한 행을 모아 한 번에** 행렬곱을 한다. 배치당 최대 6번의 그룹 연산으로 끝난다. 행마다 트리를 타면 6.6M × 6 번의 파이썬 루프가 된다.

### 패리티 실측 (2026-09-10)
`coords_v2.parquet` 표본 5,000곡을 배정해 `map_tree/node_paths_v2.parquet` 과 대조했다.

| 항목 | 값 |
|---|---|
| 대조된 곡 | 5,000 |
| 말단 노드 일치 | **5,000 / 5,000 = 100%** |
| 트리 밖 배정 | 0 |
| 쓰인 말단 노드 | 2,798 (전체 4,096 중, 표본이라 일부만 등장) |

내부 노드는 1,365개이고 `split_axes.npz` 의 축 집합이 `tree.json` 의 내부 노드 집합과 정확히 같다(테스트가 검사).

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
