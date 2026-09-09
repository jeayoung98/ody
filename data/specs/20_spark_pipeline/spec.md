# 20 Spark 파이프라인 이식 — spec

상태 ⬜ · 목표일 09-10~11 (원본 적재 잡은 09-12 가동, 완주는 배포 후 허용) · 결정 D6(패리티 트랙)

## 목적
`Raw → Feature Selection → Preprocessing → PCA → Catalog → Serving Artifact` 를 Hadoop/Spark 잡으로 만들고, **현재 아티팩트(v2.2)를 비트 수준 가깝게 재현**한다. 재학습은 하지 않는다. 학습된 파라미터(`model_bundle.npz`, `split_axes.npz`, `feature_list.json`, `exclusion_rules.json`)를 적용만 한다.

## 단계와 계약
| 단계 | 입력 | 출력 (HDFS Parquet) | 패리티 기준 |
|---|---|---|---|
| S0 원본 적재 | `lowlevel/*.tar.zst` 30파트 | `raw_features/part=NN/` : `mbid, offset, part, fingerprint, codec, bit_rate, length, lossless, sample_rate, f_000..f_269(float32), title, artist` | 행 수 = 전수조사 `census_all.parquet` 의 코호트 행 수; 표본 1만 행 값 == 기존 추출 Parquet |
| S1 대표행 선택 | raw_features + `work/v2_manifest.parquet` 규칙(지문→lossless→44100→규모→part,offset) | `manifest_rows/` 7,404,506 행 | mbid 집합 == v2 manifest |
| S2 전처리 | manifest_rows + feature_list(skew) + model_bundle(delta_f, impute_median, scaler, clip) | `features_pre/` 270 f32 | 표본 10만: 최대 절대 오차 < 1e-4 vs 기존 파이프라인 |
| S3 PCA | features_pre + pca_mean, pca_components | `coords/` pc1..pc16 | **전곡** 최대 절대 오차 < 1e-4 vs `coords_v2.parquet` |
| S4 트리 배정 | coords + split_axes.npz | `node_paths/` leaf_id | 리프 일치 100% (경계값 동률은 v2 규칙과 같은 부호 처리) |
| S5 카탈로그·규칙 | manifest_rows + titles + canonical + 규칙 R1~R9(+길이 v4, flag_instrumental) | `catalog/` (계약 스키마) | `excluded` 집합 == v2.2 카탈로그, 규칙별 적중 수 동일 |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | `check_contract.py --strict --prev` 통과 |

## 수용 기준
- AC1 S2~S6 이 **기존 추출 Parquet 를 입력으로** 끝까지 돌고 패리티 기준 전부 통과 (`tests/test_spark_parity.py`, 표본 + 전곡 요약).
- AC2 S0 잡이 클러스터에서 최소 1파트 완주하고 표본 값 일치. 30파트 완주는 배포 후 허용(D6).
- AC3 각 잡은 멱등(같은 입력 → 같은 출력 해시), 파티션 단위 재시작 가능.
- AC4 실행 문서 `spark/README.md`: 제출 명령, 자원(executor 수·메모리), 소요 시간 기록.

## 비범위
재학습(M1·scaler·PCA·트리), ANN 인덱스 생성, 스트리밍.
