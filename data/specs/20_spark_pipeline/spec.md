# 20 Spark 파이프라인 이식 — spec

상태 🔶(AC0 충족, 전곡 패리티는 Q7 대기) · 목표일 09-10~11 (원본 적재 잡은 09-12 가동, 완주는 배포 후 허용) · 결정 D6(패리티 트랙)

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
| **S1.5 특징 선택** | 원본 JSON 수치 잎 **약 2,900** | `f_000..f_269` **270** | 아래 별도 절. 두 단계로 나뉘고 성격이 다르다 |
| S2 전처리 | 추출 특징 + feature_list(skew) + model_bundle(delta_f, impute_median, scaler, clip) | `features_pre/` `mbid` + `f_000..f_269` f32 | 표본 10만: 최대 절대 오차 < 1e-4 vs 기존 파이프라인. 잡은 `spark/jobs/preprocess.py` |
| S3 PCA | features_pre + pca_mean, pca_components | `coords/` `mbid` + pc1..pc16 | **전곡** 최대 절대 오차 < 1e-4 vs `coords_v2.parquet`. 잡은 `spark/jobs/pca.py` |
| S4 트리 배정 | coords + `map_tree/tree.json` + `split_axes.npz` | `node_paths/` `mbid` + `leaf_id` + `node_d1` + `node_d2` | 말단 노드 일치 100%. 표본 5,000곡 실측 완료. 잡은 `spark/jobs/tree_assign.py` |
| S5 카탈로그·규칙 | manifest_rows + coords + titles + canonical + 태그·감사 + 규칙 R1~R9 | `catalog/` 전 행 + `excluded`·`excluded_reason[]`·`dup_group_id`·`is_representative`·`flag_*` | 제외 780,107, 규칙별 적중 수 동일. 규칙은 아래 별도 절. 잡은 `spark/jobs/catalog_rules.py` |
| S6 아티팩트 | 위 전부 | `serving/<v>/` 계약 파일 + manifest(입력·규칙 해시) | 원래 문장: `check_contract.py --strict --prev` 통과. **`--prev` 는 적용 불가 — 아래 S6 절 참조.** 대체 기준은 `--strict` 통과 + 내용 대조. 잡은 `spark/jobs/artifact_export.py` |

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

## S1.5 특징 선택 — 약 2,900 → 389 → 270

목적 줄에 `Feature Selection` 이 있는데 단계 표에는 없었다(2026-09-10 지적). 선택이 추출기 안에 숨어 있어 파이프라인에 드러나지 않았다. 실제 사슬은 **두 단계**이고 성격이 다르다.

| 하위 단계 | 개수 | 성격 | Spark 에서 | 규칙 위치 |
|---|---|---|---|---|
| **S1.5a 구조 선택** | 약 2,900 → **389** | 규칙 기반, 데이터 불필요, 결정적 | **재현한다** | `scripts/feature_spec.py` docstring + `COLUMNS` |
| **S1.5b 안정성 선택** | 389 → **270** | **데이터 기반 fit** | **적용만 한다** (규칙 3) | `feature_list.json` (동결). 도출은 `dmadkr/scripts/exp_a.py` |

### S1.5a 구조 선택 규칙
원본 lowlevel JSON 을 평탄화할 때 무엇을 남기는지의 규칙이다. 데이터를 보지 않으므로 Spark 가 그대로 재현해야 한다.

- 통계팩 스칼라는 `mean`, `var`, `dmean2` 만
- 리스트 특징은 `mean` 배열만 (mfcc·gfcc 는 `mean` 뿐, `cov`·`icov` 제외)
- 고정 길이 리스트(`chords_histogram`, `thpcp`)는 그대로
- `metadata.*` 제외
- 가변 길이 시계열(`beats_position`) 제외
- `bpm_histogram_{first,second}_peak_*` 는 `mean` 만
- 문자열 특징(`key_key` 등)은 수치 벡터에서 분리해 따로 저장

### S1.5b 안정성 선택 규칙 (동결)
특징마다 인코딩 안정성 점수를 재고 임계 이상만 남겼다.

```text
S_cross = median(무작위 쌍 거리) / median(교차 인코딩 중복 쌍 거리)
S_cross ≥ 2.0 이면 유지          (S_CUT = 2.0)
```

같은 녹음을 다르게 인코딩했을 때 값이 다른 곡만큼 흔들리는 특징은 음악이 아니라 인코더를 재는 것이라 버린다. 동일 파일(같은 md5)은 쌍에서 제외하고, 코덱·비트레이트·무손실 여부가 다른 **교차 인코딩** 쌍만 분모로 쓴다(보수적 기준).

탈락 **119개**: `lowlevel` 85, `tonal` 30, `rhythm` 4.

산출물은 `work/A_kept_features.json` 의 `cut_cross` 이고, 그것이 서빙 번들의 `feature_list.json` 으로 굳었다. **v2 는 v1 목록을 그대로 물려받았다** — v1 과 v2.1 의 `features`·`skew_transform`·`winsorize_clip` 이 완전히 같음을 확인했다(2026-09-10). 다른 것은 `pca_components` 뿐이다.

**Spark 에서 이 단계를 다시 계산하지 않는다.** 중복 쌍 표본이 달라지면 다른 목록이 나오고 좌표가 바뀐다. 그건 major 버전이고 게이트 재등록 대상이다(규칙 3).

### 패리티 기준
- S1.5a: 평탄화 결과 컬럼 이름 집합이 `feature_spec.COLUMNS` 389개와 정확히 같다.
- S1.5b: 최종 컬럼이 `feature_list.json` 의 270개와 순서까지 같다.

## S2 전처리·S3 PCA — 270차원에서 16차원

재학습하지 않는다(규칙 3). `model_bundle.npz` 와 `feature_list.json` 의 동결 파라미터를 적용만 한다. 기준 구현은 `scripts/korean_common.py` 의 `serving_transform` 이다.

```text
추출 특징 270(원값)
  → 1. skew 변환      feature_list.skew_transform 이 지정한 컬럼만 log1p / signed_log1p
  → 2. delta_f 보정   lossless=false 행에만 더한다
  → 3. impute        남은 NaN 을 impute_median 으로
  → 4. scaler        (x - scaler_center) / scaler_scale
  → 5. clip          NaN·무한대를 0 으로 만든 뒤 ±winsorize_clip
  → S2 출력 270 float32
  → 6. PCA           (Z - pca_mean) @ pca_components.T
  → S3 출력 pc1..pc16
```

순서가 곧 정의다. 계산은 float64 로 하고 저장만 float32 다(기준 구현이 float64).

### 컬럼식 대신 mapInPandas 를 쓴다
270개 컬럼에 5단계를 컬럼식으로 쓰면 표현식 트리가 1,000 노드를 넘고, PCA 는 16 × 270 = 4,320 항이 된다. Catalyst 최적화가 급격히 느려지고 패리티도 보장하기 어렵다. `mapInPandas` 는 Arrow 배치를 numpy 로 받아 **기준 구현과 같은 함수**를 executor 에서 돌린다. 분산은 그대로다.

부작용: S3 이 S2 의 로더를 import 하므로 제출 때 `--py-files spark/jobs/preprocess.py` 가 필요하다.

### 번들을 클러스터로 보내야 한다
두 잡은 `model_bundle.npz`(24 KB)와 `feature_list.json`(17 KB)이 필요하다. git 에 없는 파일이므로 `spark-submit --files` 로 함께 올리고 `--bundle .` 을 준다. 명령은 `spark/README.md`.

### 패리티 실측 (2026-09-10)
`work/v2_feats/part0.parquet` 표본 3,000곡을 S2 → S3 에 통과시켜 `coords_v2.parquet` 과 대조했다.

| 항목 | 값 |
|---|---|
| 대조된 곡 | 2,774 (표본 중 coords 에 있는 것) |
| 최대 절대 오차 | **1.86e-06** |
| p99 절대 오차 | 7.41e-07 |
| 기준 | < 1e-4 |

`tests/test_preprocess_pca.py` 10건이 이 수치를 만들고, 재학습이 없다는 것(소스에 `fit` 호출 없음)과 특징 순서가 `feature_list.json` 과 같다는 것도 함께 검사한다. 표본이 3,000곡인 이유는 pyspark 없이 numpy 경로로 도는 커밋 훅 테스트이기 때문이다. 표본 10만·전곡 검증은 클러스터 실행(AC0·AC1)에서 한다.

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

## S6 serving 번들 내보내기 — 파이프라인의 끝

```text
S5 카탈로그 + S3 좌표 + S4 말단 노드
  → Spark      excluded=false 만 남기고 세 표를 mbid 오름차순으로 정렬해 내보낸다
  → 드라이버   동결 파일 7개 복사 + manifest.json 생산
  → serving/<v>/  계약 v1 파일 10개
```

### 왜 mbid 오름차순인가 — 정렬 불변식
번들을 읽는 쪽은 **`coords` 의 i번째 행 = 카탈로그에서 `excluded == False` 인 i번째 행**이라는 불변식에 의존한다. 이 하나로 좌표·메타데이터·kNN 그래프를 정수 색인 하나로 다룰 수 있다. 스펙 18 적재도 이 불변식으로 좌표와 메타데이터를 붙인다.

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

## 클러스터 실행 실측 (2026-09-10) — AC0 충족

| 항목 | S2 전처리 | S3 PCA |
|---|---|---|
| YARN application | `application_1788767549509_0005` | `application_1788767549509_0006` |
| 최종 상태 | **SUCCEEDED** | **SUCCEEDED** |
| 입력 | `hdfs:///ody/data/raw_features_extracted` 6,617,603행 | `hdfs:///ody/data/features_pre` 6,617,603행 |
| 출력 | `hdfs:///ody/data/features_pre` 6,617,603행 | `hdfs:///ody/data/coords` 6,617,603행 |
| HDFS 크기 | 6.8 G (복제 13.5 G), 파일 30개 | 632.3 M (복제 1.2 G), 파일 59개 |
| 소요 | 349초 | 126초 |
| 자원 | executor 2 × 4g × 2 core, driver 2g | 같음 |
| 누적 자원 | 3,519,635 MB-s / 1,035 vcore-s | 1,223,896 MB-s / 362 vcore-s |

팀 절차대로 표본(10만 행)을 먼저 통과시킨 뒤 전수를 돌렸다.

### 클러스터 좌표 패리티
클러스터가 쓴 `coords` 의 `part-00000` 에서 표본 5,000곡을 뽑아 `serving/v2.1-pca16/coords_v2.parquet` 과 대조했다. 4,577곡이 대조 대상이었고(423곡은 제외된 곡이라 기존 좌표에 없다) **최대 절대 오차 1.91e-06**, p99 9.54e-07 이다. 기준 1e-4 를 통과한다. 로컬 numpy 경로 실측(1.86e-06)과 같은 자리수다.

### 런타임 의존성 — 두 노드에 설치해야 한다
클러스터에는 numpy·pandas·pyarrow·pip 이 **하나도 없었다**. S2·S3 이 `mapInPandas` 를 쓰므로 없으면 실행되지 않는다.

```bash
sudo apt-get install -y python3-pip python3-numpy python3-pandas
sudo pip3 install --break-system-packages -U pandas pyarrow
```

master-node 와 app-node **둘 다** 해야 한다(실행기가 양쪽에서 뜬다). 설치 결과: Python 3.12.3, numpy 1.26.4, pandas 3.0.5, pyarrow 25.0.1, Spark 4.2.0.

⚠️ apt 의 pandas 2.1.4 로는 안 된다. Spark 4.2.0 이 `pandas >= 2.2.0` 을 요구해 `PySparkImportError [UNSUPPORTED_PACKAGE_VERSION]` 로 막힌다. pip 로 올려야 한다.

### 첫 제출에서 잡힌 버그 하나
특징 이름이 `lowlevel.gfcc.mean.0` 처럼 점을 포함하는데, 그대로 `select` 에 넘기면 Spark 가 **중첩 필드 접근으로 해석**해 `UNRESOLVED_COLUMN.WITH_SUGGESTION` 으로 실패한다. 백틱으로 감싸고 `f_000..f_269` 로 alias 해서 고쳤다(커밋 `ca492db`). 로컬 numpy 경로만 검증했을 때는 드러나지 않는 종류의 버그다. **클러스터 실행이 컷 대상이 아닌 이유가 이것이다.**

### AC0 을 판정할 때 주의
client 모드에서는 드라이버가 예외로 죽어도 SparkContext 가 정상 종료되면 YARN 이 `SUCCEEDED` 로 기록한다. 실패한 `_0001`(컬럼 오류)·`_0002`(pandas 버전)도 목록에 `SUCCEEDED` 로 남아 있다. **application id 만 보지 말고 출력 경로의 행 수를 함께 확인해야 한다.**

## 수용 기준
- AC0 **클러스터 실행** ✅ **2026-09-10 충족.** S2 `application_1788767549509_0005`, S3 `application_1788767549509_0006` 둘 다 `spark-submit --master yarn` 으로 `SUCCEEDED`. 입출력 전부 `hdfs:///`. 증거 `output/spark_run_S2_2026-09-10.json`, `spark_run_S3_2026-09-10.json`. 로컬 `local[*]` 실행 기록은 이 기준을 충족하지 않는다. **컷 대상 아님.**
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
