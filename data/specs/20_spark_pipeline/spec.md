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
| **S1.5 특징 선택** | 원본 JSON 수치 잎 **약 2,900** | `f_000..f_269` **270** | 아래 별도 절. 두 단계로 나뉘고 성격이 다르다 |
| S2 전처리 | manifest_rows + feature_list(skew) + model_bundle(delta_f, impute_median, scaler, clip) | `features_pre/` 270 f32 | 표본 10만: 최대 절대 오차 < 1e-4 vs 기존 파이프라인 |
| S3 PCA | features_pre + pca_mean, pca_components | `coords/` pc1..pc16 | **전곡** 최대 절대 오차 < 1e-4 vs `coords_v2.parquet` |
| S4 트리 배정 | coords + split_axes.npz | `node_paths/` leaf_id | 리프 일치 100% (경계값 동률은 v2 규칙과 같은 부호 처리) |
| S5 카탈로그·규칙 | manifest_rows + titles + canonical + 규칙 R1~R9(+길이 v4, flag_instrumental) | `catalog/` (계약 스키마) | `excluded` 집합 == v2.2 카탈로그, 규칙별 적중 수 동일 |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | `check_contract.py --strict --prev` 통과 |

## S1.5 특징 선택 — 차원 축소 사슬

파이프라인의 차원 축소는 **네 단계**다. 실험이 이 순서로 했고 Spark 가 이 순서를 재현한다.

```text
원본 JSON 수치 잎 약 2,929  →  389  →  270  →  PCA-16
        S1.5a 규칙 컷        S1.5b 안정성 컷      S3 PCA
```

목적 줄에 `Feature Selection` 이 있는데 단계 표에는 없었다(2026-09-10 지적). 선택이 추출기 안에 숨어 있어 파이프라인에 드러나지 않았다. 잡은 `spark/jobs/feature_select.py` 다.

| 하위 단계 | 개수 | 성격 | Spark 에서 | 규칙 위치 |
|---|---|---|---|---|
| **S1.5a 구조 컷** | 약 2,929 → **389** | 규칙 기반, 데이터 불필요, 결정적 | **재현한다** | `scripts/feature_spec.py` `build_columns()` |
| **S1.5b 안정성 컷** | 389 → **270** | **데이터 기반 fit** | **적용만 한다** (규칙 3) | `feature_list.json` (동결). 도출은 `dmadkr/scripts/exp_a.py` |

### 입력이 이미 270 인 경우
`work/v2_feats` 는 추출기가 `extract_270` 으로 270개를 직접 뽑아 둔 **체크포인트**다(컬럼 282 = 메타 12 + 특징 270, 2026-09-10 확인). 그 파일로 시작하면 앞 두 컷이 이미 적용된 지점에서 파이프라인에 들어가는 것이고, 잡은 순서만 맞춘다.

**두 컷이 없어지는 것이 아니다.** `--from-raw` 로 원본 JSON 부터 돌리면 네 단계가 전부 돈다. 원본 적재(S0)가 1차 범위 밖이라 지금은 체크포인트로 들어가지만, 코드와 패리티 검사는 전 구간에 대해 있어야 한다.

### S1.5a 구조 컷 — 약 2,929 → 389
데이터를 보지 않는 규칙이라 Spark 가 그대로 재현한다. `build_columns()` 가 이름과 순서를 결정론적으로 만든다. 버리는 근거 네 가지다.

| 버리는 것 | 이유 |
|---|---|
| `cov` / `icov` 행렬 (mfcc 13×13, gfcc 13×13, 각 icov 포함) | `mean` 벡터의 2차 통계다. 곡 간 비교에 정보가 거의 없고 차원만 폭발한다. 상관은 PCA 가 잡는다 |
| 통계팩 9갈래 중 6개 (`median` `min` `max` `dmean` `dvar` `dvar2`) | `mean`(중심)·`var`(퍼짐)·`dmean2`(프레임 간 변화율) 세 개로 분포 요약이 충분하다. 나머지는 강한 상관 |
| `beats_position` | 곡마다 길이가 다르다. 고정 차원 벡터로 못 만든다 |
| `metadata.*`, 문자열(`key_key` `chords_scale` 등) | 숫자가 아니다. 키·스케일은 별도 컬럼으로 보관한다(표시·진단용) |

남는 389 구성: 통계팩 스칼라 41 × 3 = 123, bpm 피크 6, 리스트 `mean` 187, 고정 리스트 60, plain 13.
블록으로는 timbre 247 / tonal 109 / dynamics 20 / rhythm 13.

**입력 개수는 곡마다 다르다.** `beats_position` 길이가 곡마다 달라서다. WBS 기록값이 2,929이고 실측 표본 하나는 3,034였다. 고정되는 것은 **출력 389** 이고, 규칙이 그걸 보장한다.

Spark 는 버리는 컬럼을 지우지 않는다. `select` 하지 않으므로 자동으로 배제된다.

### S1.5b 안정성 컷 — 389 → 270 (동결된 fit)
문제는 이렇다. 같은 곡인데 인코딩이 다르면(mp3 128k vs FLAC) 특징값이 흔들린다. 흔들리는 특징을 남기면 **같은 곡이 지도에서 멀어진다.**

실험 A(`dmadkr/scripts/exp_a.py`)가 특징마다 안정성을 재고 임계 미만을 버렸다.

```text
S_f = median(|무작위 두 곡 차이|) / median(|같은 곡 다른 인코딩 차이|)    둘 다 IQR 로 정규화
분자 = 이 특징이 곡을 구분하는 폭
분모 = 이 특징이 인코딩 때문에 흔들리는 폭
S_f < 2.0 이면 신호가 노이즈의 2배 미만 → 버린다        (S_CUT = 2.0)
```

같은 파일 재제출(md5 동일) 쌍 **34,060개는 제외**했다. 코덱·비트레이트·무손실 여부가 다른 **교차 인코딩** 쌍만 분모로 쓰는 보수 기준 `S_f_cross` 를 채택했다.

결과 **119개 제거, 270 유지. 검증 AUC 0.780 → 0.881.** 노이즈원이 인코딩 이질성이라는 것도 같이 나왔다(lossless↔lossy 0.797 대 동일 인코딩 0.976).

블록 구성이 389(timbre 247 / tonal 109 / dynamics 20 / rhythm 13) → 270(170 / 79 / 11 / 10) 으로 바뀌었다. **고주파 timbre 가 집중 제거됐다** — lossy 인코더가 잘라내는 대역이라 흔들림이 크다.

산출물은 `work/A_kept_features.json` 의 `cut_cross` 이고, 그것이 번들의 `feature_list.json` 으로 굳었다. **v2 는 v1 목록을 그대로 물려받았다** — v1 과 v2.1 의 `features`·`skew_transform`·`winsorize_clip` 이 완전히 같음을 확인했다(2026-09-10). 다른 것은 `pca_components` 뿐이다.

**Spark 에서 다시 계산하지 않는다.** 중복 쌍 표본이 달라지면 다른 목록이 나오고 좌표가 바뀐다. major 버전이고 게이트 재등록 대상이다(규칙 3). `feature_list.json` 의 이름과 **순서**를 그대로 select 한다. 순서가 바뀌면 PCA 행렬 16×270 곱이 조용히 깨진다.

### 패리티 기준
- S1.5a: 평탄화 결과 특징 이름 집합이 `feature_spec.COLUMNS` 389개와 정확히 같다.
- S1.5b: 최종 특징 컬럼이 `feature_list.json` 의 270개와 **순서까지** 같다.
- **사슬 일치**: 원본 문서에서 `389 → select 270` 한 값이 `extract_270` 으로 직접 뽑은 값과 같다. 실제 문서 표본으로 검사했고 최대 절대 오차가 `1e-12` 이내였다(`tests/test_feature_select_chain.py`). 두 경로가 어긋나면 Spark 결과가 기존 아티팩트와 달라진다.

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
