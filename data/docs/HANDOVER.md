# 인수인계 — AcousticBrainz 음악 지도 v2 (2026-08-31 ~ 09-06)

다른 어시스턴트(GPT 등)가 이 문서만 읽고 이어서 작업할 수 있도록 쓴다. 모든 수치는 저장소의 산출 JSON/MD 에서 나온 것이고, 파일 경로를 함께 적는다. 작업 디렉터리 `C:\Users\SSAFY\Desktop\dmadkr`, git 저장소(10 커밋), Python venv `.venv` (numpy 2.5 / pandas 3.0 / pyarrow 25 / sklearn 1.9 / duckdb 1.5). 원본 덤프는 `C:\abz_data\lowlevel` (30 파트, 630GB zstd).

---

## 0. 한 문단 요약

AcousticBrainz 저수준 특징 덤프(2,946만 제출본)에서 **essentia 2.1-beta2 코호트 740만 곡**으로 v2 음악 지도(PCA-16, 깊이 6 사분할 트리)를 새로 fit 했다. beta2 빌드 변종 9개는 md5 통제 실험으로 동질성이 확인됐고(계통편향 ≤ 지도 축 std 의 0.008%), 멜론 정답지로 채점해 **공통 곡 풀에서 v1 보다 AUC +0.047 (95% CI [+0.037, +0.056])** 를 확인한 뒤 `serving/v2-pca16` 으로 승격했다(v1 은 ARCHIVED 보존). 이웃 진단으로 후처리 규칙(τ_dup 1.66, 아티스트 상한 3, τ_far 4.91, 길이 30s–20min)을 도출했고, **카탈로그 정제(중복·비음악 제외)** 는 S0 감사와 S1 dry-run 을 마쳤고, 규칙 v3(사용자 결정 2회 반영)으로 **적용 완료** — 780,107곡(10.54%)을 표시(excluded)로 제외해 `serving/v2.1-pca16` (6,624,399곡, fit·트리 동일)을 만들었고, 브릿지 풀 Hit@10 은 0.0535 → 0.0540 (+0.9%)으로 품질 손실이 없다.

---

## 1. 데이터·자산 지도

| 경로 | 내용 | 비고 |
|:--|:--|:--|
| `C:\abz_data\lowlevel\*.tar.zst` | AB lowlevel JSON 덤프 30파트 | 원본. 스트리밍 1패스 ≈ 4~5분/파트(4-way) |
| `work/census_all.parquet` | 29,460,584 제출본 × (part, mbid, offset, 버전 지문 4튜플, lossless, sample_rate) | 전수조사 결과 |
| `work/titles.parquet`(part0), `titles_part{1..29}.parquet` | MBID 당 first-seen title/artist/album | 브릿지 재료 |
| `work/genres_raw.parquet` | 23,203,978 (mbid, offset, genre 리스트) | 자유 텍스트 태그 |
| `data/canonical/canonical_recording_redirect.parquet` | MusicBrainz 정규 리다이렉트 (7.8M) | **발매연도 없음** |
| `data/melon/song_meta.json`, `train.json` | 멜론 707,989곡 / 115,071 플레이리스트 | 영문 표기 필드 없음 |
| `work/mlhd_p2/` | MLHD+ 세션 체크포인트 (v1 우주 242,680곡) | `output/labels_mlhd_pairs.parquet` 96.5M쌍 재생성 완료 |
| `work/v2_manifest.parquet` | 7,404,506 대표 제출본 (mbid, part, offset, fingerprint, lossless, sample_rate, is_fit_sample) | MBID 당 1행 |
| `work/v2_feats/`, `v2_feats_pilot/` | 대표 제출본 270 특징 + length/md5/codec/bit_rate (30파트, ~10GB) | 커밋 금지 |
| `work/v2_m1_feats/` | M1 짝 1,025,526 제출본 특징 | |
| `work/v2_song_meta.parquet` | 곡 단위 메타 (canonical, artist_norm, title_norm, n_keys, codec, bit_rate, length, node, bridge) | 진단·정제 공용 |
| `serving/v1-pca16/` | v1 지도 (491,028곡, depth 4) — **ARCHIVED, 파일 무수정** | 기준선 |
| `serving/v2-pca16/` | v2 승격본 (7,404,506곡, PCA-16, depth 6, 4,096 리프) | 정제 전 원본, 무수정 |
| `serving/v2.1-pca16/` | **v2.1 = v2 + 카탈로그 정제** (6,624,399곡, 좌표·트리 동일, excluded 제거, 규칙 해시 7854e999ee3f14d1) | **현 서빙 대상** |
| `work/catalog_v2.parquet` | 전 7,404,506곡 + excluded / excluded_reason[] / dup_group_id / is_representative / flag_low_sr / flag_comedy / flag_spoken / flag_fieldrec / flag_clipped | 삭제 없음, 규칙 변경 시 복구 가능 |
| `pipeline/exclusion_rules.json` | 제외 규칙 v3 (전 규칙 basis 병기) | |
| `serving/v2-pca16-candidate/` | 승격 전 복사본 (동일 내용) | 정리 가능 |
| `serving/postprocess_rules.json` | 이웃 후처리 규칙 (진단 근거 병기) | |
| `gates/*.json` | 사전 등록 게이트 4개 | 사후 수정 안 함 |
| `output/*.md` | 단계별 리포트 | 아래 §9 |

.gitignore: `data/`, `work/`, `.venv/`, 좌표·노드경로 parquet, `output/*.parquet`. 커밋 대상 = 코드·게이트·리포트 md/json.

---

## 2. 단계별 기록 (시간순)

### 2.1 전수조사 (버전 × 메타 × 장르, 1패스) — `output/version_census_report.md`
- 제출본 29,460,584 / 고유 MBID 7,564,215 / 버전 지문 142개.
- **beta2 (music 1.0) 고유 MBID 7,427,303 (98.2%)**, beta1 494,256, 양버전 혼재 381,294, beta1 전용 112,962.
- v1 지도 491,028곡 중 beta2 제출본 없는 곡 111,874 (22.8%) → v2 로 가면 잃는 곡.
- beta2 안에 지문 38개, 상위 3개(`70f2e5…`, `2d9f1f…`, `cead25…`)가 제출본의 91%. 전 파트에 병렬 공존(시기 교체 아님).
- 코드: `scripts/census_all_pass.py`, `merge_census.py`, `make_version_census_report.py`.

### 2.2 beta2 변종 이질성 실험 — `output/variant_heterogeneity_report.md`
- 설계: duplicate-pair. 셀 A(같은 지문 재제출) / B1~B18(다른 beta2 지문 조합) / C(beta1↔beta2). 셀당 5,000쌍, seed 42, v1 frozen PCA-16 공간에서 거리.
- **핵심 발견**: 쌍 거리가 "0 덩어리 + 두꺼운 꼬리" 이봉분포 → median 은 추출기 효과가 아니라 '같은 오디오 파일일 확률'을 잰다. 게이트 v1(`gates/variant_gate_v1.json`)은 천장 C 가 3.951 일 것을 전제했으나 실측 0.079 → R3 기계적 발동(FULL_REVIEW).
- **md5_encoded 통제**(같은 오디오 파일만, 2차 패스 588GB): beta2 변종 간 median ≤ 0.0017, d>1.0 비율 ≤ 0.14%, 계통편향 ≤ 축 std 의 0.008%. 대조로 beta1↔beta2 는 같은 파일에서도 **4.07%** 가 d>1.0 (최대 19.3). → 변종 효과 없음, 버전 효과 실재.
- 게이트 v2 (`gates/variant_gate_v2.json`, 사용자 지정 임계 0.5% × 축 std): B10(fp73↔fp76) md5 쌍 93개 미달 → 후보 전량 62,956쌍 재표본 → 1,852쌍, PASS. **판정 MERGE_OK**, `work/v2_cohort.json` = `CONFIRMED_BY_GATE_V2`.
- 코호트 = 검정된 9개 지문 (fp71,72,73,74,76,87,99,101,103) → **7,404,506곡**. 미검정 29개 소규모 지문(전용곡 22,797 = 0.31%) 제외, music 2.0 계열·beta1 제외.
- 코드: `scripts/variant_pairs_experiment.py` (sample/extract/measure), `extract_audio_ids.py`, `b10_resample.py`, `make_variant_report.py`.

### 2.3 v2 fit 준비 — `output/v2_fit_plan.md`
- 매니페스트 규칙: 코호트 지문 → lossless → sample_rate 44100 → 지문 규모순 → (part, offset). 7,404,506행 assert 통과.
- fit 표본 100만 (part×lossless 60층, seed 42, `is_fit_sample`).
- M1 재료: 같은 mbid·같은 지문 lossless↔lossy 911,787쌍 (v1 25,222 의 36배). census 에 length 없음 → 추출 스키마에 포함.
- 파일럿 part 10·24: 적중 100%, NaN 0, 속도 모델 `분 = 2.51 + 10.05×(추출건수/1e6)`.
- 코드: `scripts/build_v2_manifest.py`, `build_v2_m1_pairs.py`, `extract_v2_features.py`(`--m1`), `run_v2_extract.sh`.

### 2.4 v2 fit 본체 — `output/v2_fit_report.md`
- 본 추출: 특징 7,404,506행 + M1 짝 1,025,526행, 미추출 0 (조기종료 버그로 61행 누락 → 수정·재추출).
- **M1**: length ±1s 통제 후 696,706쌍. 전역 오프셋 ‖Δ‖ = **0.053 IQR (v1 4.46 의 1/84)**, duplicate-pair 거리 개선 0.26%. 비트레이트별 잔차 2.95(<96k) → 1.18(320k+) 단조 — 인코딩 효과는 실재하지만 v2 lossy 의 67% 가 192k+ 라 전역 Δ 가 작게 나오는 것이 정상. 코덱별 세분은 안건(구현 안 함).
- **PCA-16 설명분산 69.89%** (v1 70.10%) — 사전 기준 ≥65% PASS. 파이프라인 v1 동일(skew → M1 → impute → RobustScaler → winsorize ±20 → PCA). 공분산 정확 고유분해(sklearn 당시 미설치).
- transform 7,404,506곡: finite 100%, 재통과 오차 1.9e-06.
- 트리 깊이 후보 4/5/6 → **사람이 6 승인** (리프 4,096, 리프당 median 1,799 — v1 ~1,900 과 정합). 노드 5,461.
- 코드: `scripts/v2_fit_m1.py`, `v2_fit_pca.py`, `v2_transform_all.py`, `v2_map_depth_candidates.py`, `v2_build_map_tree.py`.

### 2.5 v2 검증 → 승격 — `output/validation_v2.md`, `output/friday_closeout.md`
- **브릿지 v2**: titles 30파트 다수결 키 + canonical redirect + 전역 충돌 제거. 매칭 67,916 → **in-map 67,536 (해외 66,375 / 한국 1,161)**. v1 15,387 의 4.4배. 한국 곡은 한글 완전일치 1차만(영문 표기 소스 없음, 로마자 추측 금지).
- 정답지 v2: 플레이리스트 co≥2 쌍 178,917 (v1 13,829). negative = 인기도 보정(빈도 비례) 샘플러, seed 42/43/44.
- **게이트 v1 (`gates/v2_validation_gate.json`) 결과**: G1 same_artist=false 보정 AUC **0.6458 < 0.654 FAIL** → HOLD. G2 Hit@10 lift 21.6× / G3 섞기 0.4965 / G4 depth-5 lift 4.44× 단조 PASS.
- 원인: 기준선 0.674 가 저장소에서 재현 불가 (동일 샘플러로 v1 재채점 → **0.6530**) + 곡 구성이 다른 풀에 절대 문턱 적용한 설계 결함.
- **게이트 v2 (`gates/v2_validation_gate_v2.json`)**: G1' 공통 풀 쌍대 비열등성 (v1 0.6098 → v2 0.6564, **Δ+0.0466, 95% CI [+0.037, +0.056]**, 1,000회 부트스트랩) + G1'' 절대 바닥 ≥0.60 (0.6458) + G2~G4 원안 → **전부 PASS → PROMOTE**. 원 G1 FAIL 기록 보존.
- MLHD+ (보고): 보정 AUC 0.607 (v1 0.566), v1 에서 역정렬이던 classical·soundtrack 가지 포함 4가지 전부 lift>1.
- 한국 곡 첫 채점 (보고): 1,161곡 / 14,944쌍, AUC 0.656, depth-2 16노드 전부에 분포 (섬 아님, 엔트로피 2.61 vs 해외 2.73).
- M1 트리거 미발동 (lossless↔lossless 0.662 vs lossless↔lossy 0.657, 차이 0.005 < 0.02).
- 코드: `scripts/bridge_v2.py`, `validate_v2_melon.py`, `validate_v2_mlhd.py`, `validate_v1_corrected.py`, `validate_v2_gate2.py`, `make_validation_v2_report.py`.

### 2.6 서빙 전 이웃 진단 → 후처리 규칙 — `output/friday_closeout.md`, `serving/postprocess_rules.json`
- 쿼리 20,000 (브릿지 1만 + 무작위 1만), top-50, **전 지도 740만 곡** 대상.
- 규칙 (전부 진단값 근거): τ_dup **1.66** (다른 곡 최근접 p1; 같은 녹음 61% 접힘, 다른 곡 손실 1%) · 아티스트 상한 **3** (top-10 최다 아티스트 p90=3) · τ_far **4.91** (무작위 nn10 p90) · 길이 30s–20min · 허브 페널티 **OFF** (최다 7회, 상위 1% 점유 2.8%) · 표시 필터 ON (복수키 14.7%).
- **M1(c) 재개 플래그 ON**: lossy 한정 <96k 쿼리 93개의 이웃 중 같은 저비트레이트 구간 10.3% vs 우연 0.95% (11×). 소표본 주의.
- 전/후 (브릿지 쿼리 1,000): Hit@10 0.0294 → 0.0294 (0%), 중복률 0.029 → 0, 도배율 0.044 → 0.
- 시각화 표본 `work/viz_sample.parquet` 265,733곡 (pc1/pc2, node, genre, is_korean).
- 코드: `scripts/serving_diagnostics.py`, `postprocess_ab.py`, `make_friday_closeout.py`.

### 2.7 카탈로그 정제 (완료) — `pipeline/`
- 목표: 같은 곡 중복 버전(R6)·비음악(R2)·길이 극단(R1)·무음(R8)·손상 추출(R9) 등을 **삭제 아닌 표시**(excluded_reason)로 제외. 커버곡 유지, live/acoustic/remix 는 별도 묶음.
- 단계: `python pipeline/run.py --stage s0_audit` (읽기 전용 감사 → `output/catalog_audit.md`) → 사람 검토 → `--stage s1_dryrun` (규칙 적중·표본 → `output/exclusion_dryrun.md`) → 사람 "승인" → `--stage s1_apply --approve "승인"`.
- **S0 감사 완료** (`output/catalog_audit.md`, 26분) — 핵심 수치:
  - A1 길이: <30s **99,950** (1.35%), >20min **29,966** (0.41%). >20min 중 태그 있는 13,143곡의 35.7%가 클래식/오페라/앰비언트(예외 유지 근거). 태그 없는 >20min 16,823곡은 예외 판단 불가.
  - A2 SR<44100: 18,047 (0.24%), 좌표 편향 최대 |0.46| std (pc3) → 제외 아닌 플래그.
  - A3 무음: loudness 하위 0.1% 7,405곡 중 silence_rate_60dB>0.9 **116곡** (Headspace 명상, John Cage, 무음 히든트랙).
  - A4 winsorize 적중: ≥1 특징 167,369 (2.26%) — 1개 적중 표본은 정상 음악이라 손상 아님. **≥5개 4,762곡**만 후보(검수 대상).
  - A5 비음악 태그: 12개 키워드 전부 적중, 합집합 **35,901** (0.49%). comedy 20,876이 최대(카바레 송 혼입 위험).
  - A6 중복: 2곡+ 묶음 706,401 / 접힘 후보 1,520,985 (20.5%) / **거리>4 보호 918,463 (60%)** / 접힘 예상 **602,522 (8.1%)**. 묶음 멤버 거리 median 5.34 — 제목이 같아도 대부분 다른 연주.
  - A7 같은 MBID 제출본 간 v2 거리: median **0.58**, p90 5.18, >4 비율 13.5% → R6 보호 임계 4.0의 근거.
  - A8 연도 소스 **없음** (canonical 덤프는 redirect+release_mbid만).
- 규칙 초안 `pipeline/exclusion_rules.json` (전부 감사 수치 basis): R1 30s–20min(클래식/오페라/앰비언트 예외) · R2 12키워드 · R3 · R4 · R5 · R6 protect 4.0, live 등 별도 · R7 **off(플래그)** · R8 116곡 · R9 ≥5 특징(**검수 후 확정**). 중단 임계 총 제외 15%.
- **S1 dry-run v1** (`output/exclusion_dryrun_v1.md`): 총 제외 17.38% > 임계 15% → 중단. 초과 주인 R5 canonical 중복 763,015곡, 멤버-대표 좌표 거리 median 6.31 (같은 MBID 재제출본 0.58) — MB 병합 ≠ 같은 소리.
- **사용자 결정 (2026-09-06)**: R5 에 R6 와 같은 거리 보호 4.0 · R1 미태그 곡 상한 30min(태그 비예외 20min, 클래식/오페라/앰비언트 예외 유지, <30s 유지) · R2 'comedy' 제외→`flag_comedy` · R9 제외→`flag_clipped`. → `pipeline/exclusion_rules.json` v2.
- **S1 dry-run v2** (`output/exclusion_dryrun_v2.md`): 총 제외 10.61%. depth-1 편중 해소(root.2 21.0% → 12.3%). R2 표본에 'field recording'·'spoken word' 태그 음악 오적중 확인.
- **사용자 결정 #2**: R2 에서 'spoken word','field recording' 제거 → `flag_spoken`/`flag_fieldrec` (9키워드 유지). **조건부 사전 승인**: 총 제외 10.0~10.7% ∧ R2 8,000~11,000 ∧ 타 규칙 적중 불변이면 사람 재확인 없이 apply.
- **S1 dry-run v3 + apply (`output/exclusion_report.md`, `s1_auto_decision.json`)**: 총 제외 **780,107 (10.54%)**, R2 10,014, R1/R3/R5/R6/R8 = 113,841/10,976/241,660/407,026/116 (불변) → 조건 전부 만족 → **적용**. depth-1: root.0 11.6% · root.1 9.4% · root.2 12.3% · root.3 8.8% (최대 1.17×).
- **재검증**: 브릿지 풀 정답쌍 178,917 중 제외로 사라진 쌍 6,758 (3.78%), Hit@10 **0.0535 → 0.0540 (+0.9%)** — 5% 이내, 품질 손실 없음.
- 산출: `work/catalog_v2.parquet` (7,404,506행, 삭제 없음), `serving/v2.1-pca16` (6,624,399곡, manifest PROMOTED v2.1, fit·트리 재학습 없음, 규칙 해시 기록), 플래그 컬럼 comedy 20,876 · spoken 5,682 · fieldrec 1,145 · clipped 4,762 · low_sr 18,047.
- 실행: `python pipeline/run_s1_auto.py` (규칙 v3 → dry-run → 조건 검사 → 조건부 apply). 이전 dry-run 은 `exclusion_dryrun_v1/v2.*` 보존.
- 확인된 제약: canonical 덤프에 발매연도 없음 → R6 대표 선정은 수식어 없는 제목 → lossless → 제출본 수 → (part, offset).

### 2.8 주말 정성 확인 — 좌표 찍기 + 유사도 (눈과 귀) — `output/qual_check.md`, `output/qual_journey.md`, `output/viz/`
- 목적: 숫자(AUC·Hit@K)가 아닌 **사람 눈·귀**로 v2.1 지도를 확인. **원칙: 정성 결과로 좌표·규칙을 즉석 수정하지 않는다 — 관찰만 기록, 변경은 월요일 결정.** 음원 재생·다운로드·임베드 없음, YouTube **검색** URL 만.
- 번들: `serving/v2.1-pca16` 만 사용 (6,624,399곡, 후처리 규칙 τ_dup 1.66 · artist cap 3 · 길이 30–1200s · τ_far 4.91 적용).
- 산출 (`scripts/qual_prepare.py` 2.8분 → `scripts/qual_render.py` 0.2분):
  - `output/viz/map_v2.html` (31.6MB, **git 미포함** — 좌표 표본 포함, 로컬 재생성): plotly scattergl 단일 파일. 표본 243,228점(v2.1 잔존 `work/viz_sample.parquet`), 토글 depth-2 / depth-1 / 멜론 장르 오버레이(브릿지 65,910곡) / 한국 곡 강조(1,158) / 리프 중심 4,096 (크기=곡 수, 색=브릿지 최다 장르). hover = 아티스트·제목·노드·리프·장르. ◆ 200곡(20 쿼리 + 인기 브릿지 180) 클릭 → 후처리 top-10 사이드 패널(사전 계산, `work/qual/clickable.json`). 보려면 `python -m http.server --directory output/viz` 로 열기(file:// 도 됨).
  - `output/viz/map_v2_{all,genre,korean}.png` 300dpi (전체 depth-2 색 / 장르 오버레이 / 한국 곡 강조).
  - `output/qual_check.md`: 20곡 쿼리(발라드 3·댄스 3·락 2·힙합 2·R&B 2·재즈 2·클래식 2·OST 1·한국 곡 3; 브릿지에서 플레이리스트 등장 상위, 아티스트 중복 없이) 후처리 top-10 표 + 원본 top-10 접힘 + 사람 점수 빈칸(`__/10` = 이어 틀어도 어색하지 않은 곡 수) + 결함 코드(dup/spoken/wrong-mood/meta). 거리 눈금 표(같은 곡 <1 · τ_dup 1.66 · top-10 끝 ~3 · 정답쌍 median 10.7 · 무관 ~14). 역방향 3쌍(정답쌍인데 거리 >14; 지도 내 정답쌍 172,159 중 33,095 = 19.2% 가 >14). 자동 관찰 표(장르 × depth-1 분포, 숫자만).
  - `output/qual_journey.md`: 여정 2개(발라드→댄스 10.46 / 한국 곡→해외 힙합 15.29), 16-D 직선 10등분 → 각 지점 최근접 미사용 곡(canonical 제외·아티스트 ≤2·길이 규칙), 역마다 검색 링크 + "끊김?" 빈칸.
- 기계적으로 확인된 사실(해석은 월요일):
  - 20 쿼리 후처리 top-10 안의 정답쌍(✓)은 20곡 중 1곡(Q15 Joep Beving)만 1개 — 6.6M 풀에서 Hit@10 5.4% 이므로 구조적. 10위 거리는 2.3–4.2 (τ_far 4.91 미만, '유사도 낮음' 표시 0건).
  - 장르 × depth-1 편중(브릿지 표본): 록/메탈(해외) root.2 56% · 재즈 root.1 55% · 랩/힙합(해외) root.3 65% · 일렉트로니카 root.3 55% · 클래식/뉴에이지 root.0 56%/50% · POP 은 균등(최대 33%) · '기타' root.3 77%. 국내 장르(발라드·댄스·랩/힙합 국내)는 브릿지 표본 100곡대라 판단 보류.
  - 한국 곡 1,158점은 특정 사분면에 몰리지 않고 지도 중앙부에 넓게 퍼짐(`map_v2_korean.png`).
  - 역방향 3쌍은 모두 '발라드/어쿠스틱 ↔ 댄스/EDM' 조합(CHEEZE↔Red Velvet, 성시경↔씨스타, Mike Perry↔Lauv) — 플레이리스트 동반 ≠ 음향 유사의 예로 보이나 **귀로 확인 필요**.
- 사람이 채울 것: `qual_check.md` 점수 20칸 + 결함 코드, 역방향 3쌍 판정, `qual_journey.md` 끊김 지점, 관찰 메모. 채운 뒤 월요일에 규칙·좌표 변경 여부 결정.
- **kNN 그래프 + A\* 여정** (사용자 요청 — 원래 구상한 '이웃 그래프 위 최단 경로' 방식으로 여정 재구성, 직선 보간과 비교):
  - 그래프 `work/knn_graph/{indices,dists}.npy` (git 미포함, 각 795MB): v2.1 6,624,399곡 × k=30, `scripts/knn_graph_build.py`. 근사 방법 = k-means 4,096 셀(1M 표본 fit) 다중 탐침 P=64, 3샤드 병렬 ~92분 + `--merge`. **표본 300곡 recall@30 = 0.912 (사전 목표 0.95 미달)**, 30번째 이웃 거리 비율 1.002 → 누락은 근접 동률. 정성 여정용으로 사용하되 미달 사실 기록(게이트 아님). 첫 시도(트리 리프 중심 탐침)는 P=48 에서 recall 0.80 으로 기각 — 리프가 길게 늘어진 영역이라 중심 탐침이 안 됨. 그래프 거리: d1 median 2.62 / d10 3.30 / d30 3.61.
  - A\* (`scripts/journey_astar.py`): 무방향(나가는+들어오는 간선), 비용 = 유클리드, 휴리스틱 = 도착까지 직선거리(허용 가능). 통과 불가 = 길이 규칙 위반·제목 없음. 결과 `work/qual/journeys_astar.json`, `output/qual_journey.md` A\* 절.
  - **비교 결과**: 발라드→댄스 직선 10.46 → A\* 경로 17.75 (6 hops, 우회 ×1.70, 역 5) · 한국곡→해외힙합 직선 15.29 → 26.31 (8 hops, ×1.72, 역 7). **직선 보간 여정은 인접 역이 실제 그래프 간선인 비율 27%** (두 여정 모두) — 즉 직선 보간의 '역 → 다음 역' 대부분은 서로 이웃(k=30)이 아니었다. A\* 는 100%(구조적). 최단 경로가 6~8 hop 이라 역이 10개가 안 됨 — 간선 비용을 거리² 로 두면 잔걸음 경로(역 많음)가 나오는데 이는 월요일 선택지.
  - **A\* d² 변형** (간선 비용 거리², τ_dup 미만 간선 차단, h = 직선 × τ_dup): 발라드→댄스 8 hops(역 7, hop median 2.58) — 잔걸음 효과 미미(최근접 2.6 vs 30번째 3.6 으로 간선 길이 폭이 좁음). 한국곡→힙합은 **탐색 예산 초과(200만 노드)** — 휴리스틱이 실제 비용(hop 당 ≈9)보다 훨씬 약해 다익스트라처럼 퍼짐. 그래프 단절이 아님. 진단용으로만 남기고 양식에서 제외.
  - **결론(사용자와 합의)**: 최단 경로는 "가장 적게 갈아타는 길"이라 부드러운 여정과 목적이 다르다. 부드러운 여정 = **고정 길이 경로 최적화** → 층별 DP.
- **층별 DP 여정** (`scripts/journey_layered.py` → `work/qual/journeys_layered.json`, `output/qual_journey.md` 층별 DP 절):
  - 출발→도착 축의 진행도 p 로 층 10개(p = k/11 ± 1/22), 축 이탈 r ≤ R 통로(4.0 시작, 층당 200곡 미만이면 0.5 씩 확대, 최대 6.0), 층당 r 작은 순 4,000곡. 전이 = 서로 30-이웃(kNN 그래프)일 때만, 거리 < τ_dup 전이 금지. 비용 Σ걸음² (Viterbi). 이웃 간선으로 길이 없으면 거리 ≤ τ_far 로 완화하고 표기. canonical 중복·아티스트 상한 3 위반 시 제거 후 재실행.
  - **결과** (둘 다 이웃 간선만으로 성공, 역 10개, 간선 비율 100%, 제약 위반 0): 발라드→댄스 R 4.5, 경로 25.98 (직선 10.46, 우회 ×2.48), 걸음 median 2.29 / 최소 1.98 / 최대 3.10 · 한국곡→해외힙합 R 5.5, 경로 32.49 (직선 15.29, ×2.12), 걸음 median 2.99 / 2.35 / 3.75. A\* 최단(걸음 ≈3, 역 5~7)보다 걸음이 작고 고르며 역 10개가 채워짐. 우회 2~2.5× 는 역 10개를 실제 이웃 간선으로 채우는 대가(설계상 예상).
  - 평가 양식: J1·J2 직선 보간, J3·J4 A\*(거리 비용), J5·J6 층별 DP, J7·J8 층별 DP+축 — 각 판 따로 채점, 끝에 가장 자연스러운 판 한 줄. 어느 방식이 "귀에" 나은지는 채점으로만 결정.
  - **층별 DP+축** (사용자 요청, 청취 관찰 '직선 우세' 가설 검증): 비용 = Σ걸음² + λ·Σ(역 축이탈)², 이웃 간선 제약 유지. **λ=0.5·1·2 가 모두 같은 경로** → λ 에 둔감. 결과: 발라드→댄스 축이탈 median 3.19 → **2.54** (직선 보간 2.1~2.6 수준), 걸음 median 2.29 → 2.54 / 최대 3.10 → 2.86 (더 고름), 우회 ×2.48 → ×2.73 · 한국곡→힙합 축이탈 4.39 → **3.14**, 걸음 2.99 → 3.07 / 최대 3.75 → 3.71, 우회 ×2.12 → ×2.24. 즉 우회 10% 비용으로 축 근접을 직선 보간 수준까지 끌어오면서 이웃 간선 100% 유지. 귀로 직선 보간과 비교하는 것이 J7·J8 의 목적.
  - **곡률 DP · 축 우선 DP · 근거리 여정** (`scripts/journey_smooth.py` → `work/qual/journeys_smooth.json`, `qual_journey.md` '곡률 DP' 절; 사용자 "제일 나아 보이는 걸로" 위임, "이전보다 나아졌지만 아직 부드럽지 않다"는 피드백 뒤):
    - 곡률 DP = 층별 DP+축 + 방향 전환 벌점 μ·||(w−v)−(v−u)||² (2차 Viterbi, 층당 후보 = 앞 층과 이웃 간선 있는 곡 중 축 이탈 작은 순 400) + 카탈로그 표시 곡(flag_comedy/spoken/fieldrec/clipped/low_sr 38,897) 후보 제외. 효과 작음: 발라드→댄스 방향 전환 median 3.08 → 2.89, 축 이탈 3.19 → 3.15; 한국→힙합은 DP+축과 **같은 경로**. 표시 곡 제외는 경로에 영향 없음(경로 위에 표시 곡 없었음).
    - 축 우선 DP = 이웃 간선 제약을 버리고 전이 '거리 ≤ τ_far 4.91' 만, λ=2, 곡률 벌점 유지 — 청취 관찰 가설('귀에는 이웃 간선보다 축 근접') 을 그대로 구현한 직선 보간의 최적화판. 발라드→댄스: 축 이탈 **2.49** (직선 보간 2.38 수준), 걸음 2.65 [1.71, 3.01] (직선 보간 3.32 [2.00, 3.98] 보다 작고 고름), 간선 82%. λ=2·4 동일 경로, λ=1 거의 동일.
    - 근거리 여정 추가: 첫 실행은 is_korean 만으로 걸러 TWICE→AOA(K-pop 쌍, 6.17) 가 뽑힘 → 해외 = 멜론 해외 장르 코드(GN0900~GN1400) 로 정정, 거리 9.0~10.7. 선택: **CHEEZE — Madeleine Love → Lauv — Paris in the Rain** (9.87, 동반 60, 후보 423쌍). 직선 보간 / 곡률 DP / 축 우선 DP 생성 (양식은 직선·축 우선만).
    - **기계적 관찰(중요)**: 직선 보간은 '방향 전환' 지표가 **가장 나쁘다** (median 5.65, 연속 걸음 cos −0.40 = 지그재그) 인데 귀에는 가장 자연스러웠다 → 16-D 에서의 걸음 연속성(이웃 간선·방향 일관성)은 청감 부드러움과 거의 무관하고, **역이 두 끝점 직선에 얼마나 붙어 있나(축 이탈)** 만 청취 결과와 같은 방향. 월요일 함의: 여정 목적함수는 '축 근접 + 걸음 상한' 이면 충분할 수 있고, kNN 그래프는 여정보다 탐험 UI·진단용.
    - 양식: J9 곡률 DP · J10 축 우선 DP (발라드→댄스), J11 근거리 직선 보간 · J12 근거리 축 우선 DP. 한국→힙합의 곡률 DP·축 우선 DP 는 J8(층별 DP+축)과 **동일 경로**라 양식에서 자동 제외(중복 청취 방지). **청취 우선순위: J10 vs J1, 그다음 J11 vs J12.**
  - **사용자 청취 관찰 (2026-09-07)**: 발라드→댄스는 **직선 보간이 압도**(A\*·층별 DP 보다 자연스러움). 한국곡→해외힙합은 **세 방식 모두 별로**. 대조 수치: 직선 보간 역의 축 이탈 2.1~2.6 vs 층별 DP 2.9~5.4 → 귀에는 '앞 곡과 이웃'보다 '두 끝점 직선 위에 있음'이 더 중요했을 가능성(n=1). 한국곡→힙합은 끝점 거리 15.29(무관 눈금 초과)이고 축 중간이 재즈 지대(root.1.3)를 지남 — PCA 직선 중점 ≠ 청감 중간. 월요일 후보: (a) 여정 허용 끝점 거리 상한(예: 정답쌍 median 10.7), (b) 층별 DP 비용에 축 이탈 r² 항 추가(축 근접 + 이웃 간선 동시), (c) 여정 쌍을 5~10개로 늘려 '직선 우세'가 일반적인지 확인. 좌표·규칙 변경 없음.
- **평가 양식** (`scripts/qual_eval_form.py` → `output/qual_eval_form.md`, `output/qual_scores_template.csv` 225행): 기준 = "쿼리 곡 직후 이어 나와도 자연스러운가" 를 이웃 곡마다 **O/X** (분위기·템포·편성·보컬 유형·질감만 보고, 가수·언어·장르 이름표·거리 숫자는 무시). 결함 코드 `dup`/`spoken`/`mood`/`tempo`/`meta`/`nf`(판정 불가, 분모 제외). 역방향은 A(소리 다름=지도 맞음)/B(소리 비슷=지도 결함 후보)/C. 여정은 **바로 앞 곡**과의 이어짐 O/X. 기록은 CSV 한 곳(`qual_scores.csv` 로 복사해 ok/defect/note 만 채움). 집계는 `python scripts/qual_eval_summary.py` → `output/qual_eval_summary.md` (쿼리 점수 = O/(10−nf)×10, 묶음 평균, 결함 빈도; 읽는 기준 사전 기재: 평균 ≥7 쓸 만함 / 5~7 묶음 확인 / <5 좌표 의심, dup ≥5% → τ_dup 재검토 후보, spoken ≥3 → R2 재검토 후보 — 게이트 아님, 변경은 월요일 결정). 더미 CSV 로 집계 스크립트 동작 확인 완료.

### 2.9 개발 트랙 시작 (2026-09-07 저녁) — 1차 배포 09-14
- 계획: `output/plan_release1.md` (서빙은 기존 아티팩트, Spark 이식은 패리티 트랙, 일별 산출물·완성도 기준·컷 순서·리스크).
- 결정 D1~D6: `specs/DECISIONS.md` (길이 60s~6min → v2.2 · `flag_instrumental` · 여정 linear 기본/axis 내부 플래그 · 먼 곡 항상 잇기+far 표시+역 수 10~20 · FastAPI · 비인기 곡 티어는 2차 · Spark 는 패리티 트랙).
- SDD 골격: `CLAUDE.md`(프로젝트 규칙), `specs/README.md`(규약), `specs/00_artifact_contract`(**서빙 아티팩트 계약 v1** — 파일·스키마·manifest 키·major/minor 버전 규칙·수용 기준), `10_retrieval_neighbors`, `11_journey`, `12_tree_explore`, `20_spark_pipeline`, `30_eval_jobs` (각 spec/plan/tasks).
- 하네스: `tests/check_contract.py`(계약 검사기, v2.1 PASS 41 OK/1 WARN, 30s), `tests/test_contract.py`(CURRENT 번들 검사), `tests/test_postprocess_rules.py`, `serving/CURRENT.json`(배포·롤백 포인터), `.claude/settings.json` PreToolUse 훅 → `scripts/hooks/pre_commit_gate.py`(`git commit` 감지 시 `pytest -q tests`, 실패면 커밋 차단). pytest 9.1 설치.
- 다음(09-08): 길이 규칙 v4 dry-run → v2.2 (`scripts/artifact_finalize.py` 로 files 해시·contract_version) → CURRENT strict 전환 → `retrieval/` 이웃 라이브러리·API.

---

## 3. 사전 등록 게이트 (사후 수정 없음)

| 파일 | 판정 | 비고 |
|:--|:--|:--|
| `gates/variant_gate_v1.json` | FULL_REVIEW (기계적) | 천장 눈금 가정 오류, 기록 보존 |
| `gates/variant_gate_v2.json` | MERGE_OK | 주 통계 md5 통제, 임계 0.5%×축 std (사용자 지정) |
| `gates/v2_validation_gate.json` | HOLD (G1 FAIL 0.6458) | 기록 보존 |
| `gates/v2_validation_gate_v2.json` | **PROMOTE** | 공통 풀 비열등성 + 절대 바닥, 재등록 사유 명기 |

---

## 4. 사람이 내린 결정 (재론 금지)
1. v2 코호트 = 검정된 9개 beta2 지문 (7,404,506곡) — `work/v2_cohort_decision.json`
2. 변종 게이트 v2 임계 0.5% / B10 은 재표본으로 해결
3. M1 = v1 동일 구조(전역 오프셋) + 코덕 진단만; fit 표본 100만; PCA 16
4. 트리 깊이 **6**
5. 검증 게이트 v2 재등록 (G1' 비열등성 −0.01 + G1'' 0.60) → 승격

---

## 5. 열린 안건
- **M1(c)**: 같은 원본 두 인코딩 쌍 재정의 + 비트레이트 조건부 오프셋. 진단에서 저비트레이트 동종성 11× (n=93) — 표본 키워 재측정 후 착수 여부.
- **한국 곡 수율 0.48%** (1,161/239,941): MusicBrainz artist alias 로 한글↔로마자 대응표를 만들면 추측 없이 올릴 여지. 별도 실험.
- **`genre_gn_all.json` 부재** — 원 출처(Kakao Arena) 재다운로드 필요. 장르 코드→이름 표기 불가.
- **v1 보정 기준선 0.674 의 출처 불명** — 재현값 0.6530 사용.
- **MLHD 재채점**: 복구한 원본 96.5M쌍으로 v2 1M 표본 재채점 (현재 값은 세션 3M 표본 기반).
- UI: 깊이 6 → 탐험 단계 6. 중간 깊이 기본 진입 여부.
- **서빙 전환**: `serving/v2-pca16` → `serving/v2.1-pca16` 으로 서빙 경로 변경 필요 (후처리 규칙 파일도 v2.1 에 동봉). 후처리 τ_dup 1.66 은 R6 가 못 잡은 잔여 중복의 2차 방어로 유지.
- 정제 규칙 재검토 후보: R6 미분류 괄호 719,842곡(보수적으로 접지 않음), '연도' 소스 확보 시 R6 대표 = 최초 발매 우선으로 승격.
- `serving/v2-pca16-candidate/` 삭제 가능(승격본과 동일, 0.8GB).
- **정성 확인 채점 대기**: `output/qual_check.md`·`qual_journey.md` 의 사람 점수·끊김 표시가 비어 있음. 채운 뒤 월요일에 (a) 후처리 규칙 조정 여부 (b) 역방향 쌍이 지도 결함인지 판정. 정성 결과로 좌표·규칙을 바로 바꾸지 않는다.

---

## 6. 눈금 (숫자 읽을 때)
- v1 PCA-16 공간: 랜덤쌍 median ≈ 15.7, 멜론 정답쌍 median 10.7, 지도 축 std pc1 6.73 ~ pc16 1.70.
- v2 공간: 같은 MBID 다른 제출본 거리는 `catalog_audit` A7 참조. 후처리 τ_dup 1.66 / τ_far 4.91.
- AUC 는 Mann-Whitney(numpy), 인기도 보정 negative(플레이리스트 빈도 비례), seed 42/43/44 평균.

---

## 7. 재현 명령 (순서)
```bash
# 전수조사 → 변종 실험 → fit → 검증 → 진단 (전부 .venv 파이썬, PYTHONUTF8=1)
bash scripts/run_census_all.sh
python scripts/variant_pairs_experiment.py sample && bash scripts/run_variant_extract.sh && bash scripts/run_audioid_extract.sh && python scripts/variant_pairs_experiment.py measure && python scripts/make_variant_report.py
python scripts/build_v2_manifest.py && python scripts/build_v2_m1_pairs.py && PAR=4 bash scripts/run_v2_extract.sh
python scripts/v2_fit_m1.py && python scripts/v2_fit_pca.py && python scripts/v2_transform_all.py run && python scripts/v2_transform_all.py finalize && python scripts/v2_build_map_tree.py
python scripts/bridge_v2.py && python scripts/validate_v2_melon.py && python scripts/validate_v2_mlhd.py && python scripts/validate_v1_corrected.py && python scripts/validate_v2_gate2.py
python scripts/build_v2_song_meta.py && python scripts/serving_diagnostics.py && python scripts/postprocess_ab.py && python scripts/make_friday_closeout.py
python pipeline/run.py --stage s0_audit   # → 검토 → s1_dryrun → 승인 → s1_apply --approve "승인"
python scripts/qual_prepare.py && python scripts/qual_render.py   # 정성 확인 (v2.1 만) → output/viz, qual_check.md, qual_journey.md
for s in 0 1 2; do SHARD=$s NSHARD=3 P_FIXED=64 python scripts/knn_graph_build.py & done; wait; P_FIXED=64 python scripts/knn_graph_build.py --merge   # kNN 그래프 k=30 (~92분)
python scripts/journey_astar.py && python scripts/journey_layered.py && python scripts/qual_eval_form.py   # A*·층별 DP 여정 + 평가 양식(J1~J6) ; 채점 후 python scripts/qual_eval_summary.py
```

---

## 8. 작업 규칙 (이 프로젝트에서 지켜온 것)
- 판정 기준은 **측정 전에 게이트 파일로 등록**하고 사후 수정하지 않는다. 기준이 틀렸으면 새 id 로 재등록하고 사유·원 판정을 보존한다.
- 임계값은 관찰값에 맞추지 않고 '지도가 견딜 수 있는 양'(축 std 대비) 같은 외부 근거로 정한다.
- 삭제 대신 표시, 곡 개별 제외 금지, fit·트리 재학습은 별도 결정.
- v1 자산 무수정, 원본·특징·좌표 커밋 금지, 검증 수치는 산출 코드와 같은 커밋.
- 출처 표기: Kakao Entertainment, melon (www.melon.com) · MLHD+ (MetaBrainz Foundation) · MusicBrainz canonical dump 2026-08-17.

---

## 9. 리포트 목록
`output/version_census_report.md` · `variant_heterogeneity_report.md` · `v2_fit_plan.md` · `v2_fit_report.md` · `validation_v2.md` · `friday_closeout.md` · `catalog_audit.md`(S0) · `exclusion_dryrun_v1/v2.md` · `exclusion_dryrun.md`(v3) · `exclusion_report.md`(apply) · `s1_auto_decision.json` · `qual_check.md` · `qual_journey.md` · `viz/map_v2.html`(로컬 재생성) · `viz/map_v2_*.png` · 수치 JSON 은 같은 이름 `.json`.
