# 인수인계 — ODY AI/Data 트랙 → 팀 저장소 `S15P21A405` (BE4 재영)

작성 2026-09-09 (수) · 1차 배포 2026-09-14 (월) · 원본 작업 저장소 `C:\Users\SSAFY\Desktop\dmadkr` (실험 이력 전체는 `output/HANDOVER.md`)

이 문서는 실험 저장소(dmadkr)의 결과를 팀 저장소 구조(`backend/ frontend/ infra/ ops/ observability/ scripts/ docs/`)로 옮겨 개발을 시작하기 위한 것이다. 팀 README 는 "실제 AI 작업이 시작될 때 `data/` 를 프로젝트 구조와 함께 추가한다"고 정했으므로, **`data/` 디렉터리를 신설**하고 아래 구조로 들어간다.

---

## 0. 지금 상태 한 문단

AcousticBrainz 660만 곡(v2.1 번들, essentia 2.1-beta2 코호트, PCA-16, 깊이 6 사분할 트리 4,096 리프)의 좌표·트리·후처리 규칙·카탈로그가 **완성·검증·승격**돼 있다(멜론 공통 풀 AUC v1 대비 +0.047, CI [+0.037, +0.056]). 09-07 에 개발 결정 6건(D1~D6)과 1차 배포 계획, SDD 스펙 6개, 아티팩트 계약 v1 + 검사기를 만들었다. **코드 개발(`retrieval/`, `spark/`)은 아직 0 줄**이다. 09-14 까지 남은 것은 (1) 길이 규칙 반영 v2.2 아티팩트, (2) 이웃·여정·트리 API(Python), (3) Spark 이식 패리티, (4) 배포다.

---

## 1. 팀 저장소 안 위치 — `data/` 제안 구조

```
S15P21A405/
└── data/
    ├── README.md                 # 이 문서 §0·§6·§8 요약 + 실행 명령
    ├── AGENTS.md                 # dmadkr/CLAUDE.md 내용 (AI 트랙 규칙 8개 + SDD 규약). 팀 AGENTS.md 는 인프라 전용이라 분리
    ├── requirements.txt          # numpy pandas pyarrow scikit-learn duckdb fastapi uvicorn pytest (faiss 선택)
    ├── Dockerfile                # python:3.12-slim, 아티팩트는 이미지 밖(볼륨)
    ├── specs/                    # dmadkr/specs 그대로 (README·DECISIONS·00~30)
    ├── retrieval/                # [신설] artifact.py postprocess.py neighbors.py journey.py tree.py search.py api.py
    ├── spark/                    # [신설] jobs/{preprocess,pca,tree_assign,catalog_rules,artifact_export}.py, README.md(제출 명령·자원)
    ├── pipeline/                 # dmadkr/pipeline (catalog_audit.py exclusion_apply.py exclusion_rules.json run.py run_s1_auto.py)
    ├── gates/                    # dmadkr/gates (사전 등록 게이트 4개 — 기록 보존)
    ├── serving/
    │   ├── CURRENT.json          # 배포·롤백 포인터
    │   └── v2.1-pca16/           # json 만 git: manifest.json postprocess_rules.json feature_list.json fit_manifest.json map_tree/tree.json map_tree/quality_by_depth.csv
    ├── tests/                    # check_contract.py test_contract.py test_postprocess_rules.py (+ 신설 테스트)
    ├── scripts/                  # 재사용 화이트리스트만 (§3)
    └── docs/                     # HANDOVER.md(실험 이력) plan_release1.md qual_check.md qual_journey.md qual_eval_form.md
```

git 에 넣지 않는 것(팀 `.gitignore` 에 추가): `data/serving/*/coords*.parquet`, `data/serving/*/map_tree/*.parquet`, `data/serving/*/map_tree/*.npz`, `data/serving/*/model_bundle.npz`, `data/work/`, `*.npy`. 이들은 §2 의 서버 위치에 둔다.

옮기는 명령(dmadkr 기준, 복사 후 팀 저장소에서 검토·커밋):
```bash
D=C:/Users/SSAFY/Desktop/dmadkr; T=C:/Users/SSAFY/Desktop/S15P21A405/ai
mkdir -p $T/docs $T/serving/v2.1-pca16/map_tree $T/scripts
cp -r $D/specs $D/pipeline $D/gates $D/tests $T/ && cp $D/CLAUDE.md $T/AGENTS.md && cp $D/pytest.ini $T/
cp $D/serving/CURRENT.json $T/serving/ && cp $D/serving/v2.1-pca16/*.json $T/serving/v2.1-pca16/ && cp $D/serving/v2.1-pca16/map_tree/{tree.json,quality_by_depth.csv} $T/serving/v2.1-pca16/map_tree/
cp $D/output/{HANDOVER.md,HANDOVER_TEAM.md,plan_release1.md,qual_check.md,qual_journey.md,qual_eval_form.md,qual_scores_template.csv} $T/docs/
cp $D/scripts/{postprocess_ab.py,qual_prepare.py,journey_layered.py,journey_smooth.py,knn_graph_build.py,korean_common.py,validate_v2_melon.py,validate_v2_gate2.py,build_v2_song_meta.py,qual_eval_summary.py} $T/scripts/
$D/.venv/Scripts/python.exe -m pip freeze > $T/requirements.txt
```
주의: `tests/check_contract.py` 와 `pipeline/*.py` 는 `ROOT = 상위 디렉터리` 기준으로 `serving/`, `work/` 를 찾는다. `data/` 밑에서 그대로 동작한다(ROOT = `data/`). `work/` 는 `data/work` 에 junction 또는 §2 경로 환경변수 `ODY_WORK` 로.

---

## 2. 전달 데이터 (git 밖) — 크기·용도·목적지

| 데이터 | 크기 | 용도 | 목적지 | 필수? |
|---|---|---|---|---|
| `serving/v2.1-pca16/` 전체 (coords 587MB, node_paths 141MB, split_axes 1.4MB, model_bundle 25KB) | 0.7GB | **검색 서비스 런타임** | app-node 볼륨 `/data/ody/serving/v2.1-pca16/` (+ HDFS 백업 `/ody/serving/`) | 필수 |
| `work/knn_graph/{indices,dists}.npy` (6.6M×30 int32/float32) + meta.json + recall_check.json | 1.5GB | 이웃 조회 O(1) 경로. 없으면 정확 kNN 폴백(150~300ms) | app-node 볼륨 `/data/ody/graph/v2.1/` | 권장 |
| `work/catalog_v2.parquet` (7,404,506행: 제목·아티스트·길이·리프·excluded·flag_*) | 0.47GB | 검색 서비스 메타·텍스트 검색·트리 집계 · Spark S5 기준값 | app-node 볼륨 + HDFS `/ody/data/catalog/` | 필수 |
| `work/v2_song_meta.parquet` (artist_norm·title_norm·codec·n_keys) | 0.43GB | 후처리(canonical·아티스트 정규화) | app-node 볼륨 | 필수 |
| `work/v2_feats/` (7,404,506 × 270 특징 + 메타, 파트별 parquet) | **8.8GB** | **Spark S2 입력** (원본 tar.zst 대체) | HDFS `/ody/data/raw_features_extracted/` | Spark 트랙 필수 |
| `work/v2_manifest.parquet` (대표행·fit 표본 플래그) | 0.15GB | Spark S1 기준값 | HDFS `/ody/data/manifest/` | Spark 트랙 필수 |
| `work/titles*.parquet` (30파트 first-seen title/artist) · `work/genres_raw.parquet` · `work/audit_*.parquet` | ≈1GB + 0.49GB | Spark S5 카탈로그 규칙(R2 태그, R3 키, R6 제목 정규화) 입력 | HDFS `/ody/data/meta/` | Spark 트랙 필수 |
| `output/bridge_v2.parquet` (67,536) · `output/labels_melon_pairs_v2.parquet` (178,917) | 수 MB | 평가 잡·트리 대표곡·장르 요약 | app-node 볼륨 + HDFS | 필수 |
| `work/census_all.parquet` (29,460,584 제출본 × 버전 지문) | 0.59GB | S0 원본 적재 검증용 | HDFS (S0 할 때만) | 선택 |
| `C:\abz_data\lowlevel\*.tar.zst` 30파트 | **630GB** | 원본 | **이번 배포 범위 밖** (§5) | 아니오 |
| `work/v2_m1_feats/`, `work/v2_feats_pilot/`, `work/variant_feats/`, `work/mlhd_p2/`, `work/main/`, `work/part0_extract/` | 6.7GB | 실험 중간물 (M1 학습 쌍, 파일럿, 변종, MLHD, v1) | 옮기지 않음 (dmadkr 보존) | 아니오 |

전송: dmadkr(Windows) → master-node `scp` → `hdfs dfs -put`. 12GB 전송이니 오늘 시작. 체크섬은 `sha256sum` 을 양쪽에서. 서빙 번들은 app-node 로 직접 `scp`.

```bash
# 예시 (호스트·경로는 팀 STATUS.md 기준으로 맞춘다)
scp -r work/v2_feats ubuntu@master-node:/data/stage/ && ssh ubuntu@master-node 'hdfs dfs -mkdir -p /ody/data && hdfs dfs -put /data/stage/v2_feats /ody/data/raw_features_extracted && hdfs dfs -du -h /ody/data'
scp -r serving/v2.1-pca16 work/knn_graph work/catalog_v2.parquet work/v2_song_meta.parquet output/bridge_v2.parquet output/labels_melon_pairs_v2.parquet ubuntu@app-node:/data/ody/
```

---

## 3. 코드 매핑 — 무엇이 어디로

| dmadkr | 역할 | 새 위치 | 처리 |
|---|---|---|---|
| `scripts/postprocess_ab.py::apply_rules` | 후처리 규칙(τ_dup·아티스트 상한·길이·허브) — 검증됨 | `data/retrieval/postprocess.py` | 이식 + flag 후순위 추가, 단위 테스트 있음 |
| `scripts/qual_prepare.py` (topk_full, GN 코드표, yt, journey 직선 보간) | 정확 kNN 블록 행렬곱, 멜론 장르 코드→이름, 여정 linear | `data/retrieval/neighbors.py`(exact_knn), `journey.py`(linear), `common.py`(GN, yt) | 함수 단위로 이식 |
| `scripts/journey_smooth.py` (viterbi2, pair_dist, 축 우선 DP) | 여정 `mode=axis` | `data/retrieval/journey.py` | 이식, 골든 = `work/qual/journeys_smooth.json` |
| `scripts/knn_graph_build.py` | kNN 그래프 k=30 (k-means 4,096 셀 다중 탐침, 3샤드 92분) | `data/scripts/` | major 버전(좌표 변경) 때만 재실행 |
| `pipeline/exclusion_apply.py` + `exclusion_rules.json` | 카탈로그 규칙 R1~R9 dry-run/apply (numpy 기준 구현) | `data/pipeline/` (기준값) → `data/spark/jobs/catalog_rules.py` (Spark 이식) | 09-09 R1 v4(60s~6min)+flag_instrumental 반영 → v2.2 |
| `scripts/korean_common.py` | v1 frozen 전처리(skew→M1→impute→scaler→winsorize→PCA) 참조 구현 | `data/spark/jobs/preprocess.py`, `pca.py` 의 패리티 기준 | 숫자 기준으로만 사용 |
| `scripts/v2_build_map_tree.py` (트리 배정 규칙) | 노드별 local PCA-2 median 사분할 | `data/spark/jobs/tree_assign.py` | split_axes.npz 적용만 |
| `scripts/validate_v2_gate2.py`, `validate_v2_melon.py`, `postprocess_ab.py`(Hit@10) | 평가 지표 | `data/scripts/eval_all.py` (30_eval_jobs) | 컷 후보 |
| `scripts/qual_*.py`, `journey_astar.py`, `journey_layered.py` | 정성 확인 산출 | `data/docs/` 결과만, 코드는 dmadkr 보존 | 옮기지 않음 |
| `scripts/census_*`, `variant_*`, `extract_*`, `v2_fit_*`, `exp_*`, `mlhd_*` | 실험·fit (재학습 금지 대상) | dmadkr 보존 | 옮기지 않음 |
| `tests/check_contract.py` 등 | 아티팩트 계약 검사 | `data/tests/` | 그대로 |

---

## 4. 계약·규칙·결정 (읽는 순서)

1. `specs/00_artifact_contract/spec.md` — 번들 파일·스키마·manifest 키·major/minor 규칙. **모든 트랙의 인터페이스.**
2. `specs/DECISIONS.md` — D1 길이 60s~6min(제외 16.5%, 정답쌍 손실 4.9%) · D1b flag_instrumental · D2 여정 linear 기본/axis 내부 플래그 · D3 먼 곡 항상 잇기+`far`+역 10~20 · D4 FastAPI · D5 비인기 티어 2차 · D6 Spark 는 패리티 트랙.
3. `specs/10_retrieval_neighbors`, `11_journey`, `12_tree_explore` — API 응답 스키마·수용 기준(p95 50ms / 2s / 20ms, 제외 곡 노출 0).
4. `specs/20_spark_pipeline` — 단계 S0~S6 과 패리티 기준(좌표 오차 < 1e-4, 리프 100%, 제외 집합 동일).
5. `serving/v2.1-pca16/postprocess_rules.json` — τ_dup 1.6624 · artist_cap 3 · τ_far 4.912 · 길이 30~1200s(→ v2.2 에서 60~360s 로 갱신, basis 병기) · hub OFF · display ON.
6. `output/HANDOVER.md` — 왜 이 숫자들인지(실험 이력·게이트·사람 결정 5건).

---

## 5. 팀 인프라 실측에 맞춘 계획 수정 (09-09 확인)

팀 문서(`docs/infra/STATUS.md`, `ARCHITECTURE.md`, `notion/owner/05`) 기준: 노드 2대 × 4 vCPU / 15GiB, HDFS DataNode 2 (replication 2), YARN NodeManager 각 6144MB·3 vcores(**총 12GB·6 vcores**), Spark 4.2.0 on YARN(master client), app-node 에 Nginx·Backend Blue/Green·PostgreSQL·Neo4j 동거.

| 항목 | 09-07 계획 | 수정 | 이유 |
|---|---|---|---|
| S0 원본 630GB 적재 | 09-12 가동, 완주 배포 후 | **1차 범위 밖으로 확정** (컷 1 즉시) | HDFS 2노드 디스크·YARN 12GB 로 일주일 내 불가. 입력은 추출 특징 8.8GB(`v2_feats`) |
| Spark S2~S6 | 7.4M × 270 | 그대로, 자원 명시: 입력 파티션 ≈ 100(90MB), executor 2 × 4GB × 2 cores, driver 2GB. `collect()` 금지, 결과는 HDFS parquet | 팀 `SPARK_PIPELINE.md` 규칙(sample → schema/row 검증 → full → publish) 준수 |
| 검색 서비스 메모리 | ≤ 3GB | **≤ 2GB 목표**: coords 424MB + 그래프 k=30→**k=10 슬림 265MB**(int32 indices 만, dists 는 재계산) + 메타 ≈ 1.5GB. memmap 로드 | app-node 15GiB 를 PostgreSQL·Neo4j·Backend 와 공유 |
| 배포 | Docker, 볼륨 | app-node `ody-internal` 네트워크에 `ody-ai` 컨테이너 1개, 포트 8000 loopback. 1차는 **수동** `docker run`(이미지 태그 = git sha), 롤백 = 이전 태그. Jenkins job 은 2차 | Blue-Green 은 백엔드 전용 스크립트, 5일 안에 확장 안 함 |
| Neo4j 그래프 투영 | (계획 없음) | **1차 사용 안 함.** 6.6M 노드 × 30 간선 = 2억 간선은 15GiB 노드에 못 올림. 2차 후보: 브릿지 66,099곡 top-10 만 투영(66만 간선) | 팀 확정 기술 "Neo4j graph projection" 과의 관계는 §8 질문 |

---

## 6. Backend(Spring) 통합 지점

- Backend 는 `com.ssafy.backend.{controller,service,mapper,dto}` + MyBatis. AI 는 별도 HTTP 서비스: **`http://ody-ai:8000`** (Docker 네트워크 `ody-internal`), 환경변수 `ODY_AI_BASE_URL` (`/etc/ody/backend.env`, 로컬 `.env.local`).
- Backend 가 프록시하는 엔드포인트(스펙 10/11/12):
  - `GET /songs/search?q=&limit=20`
  - `GET /songs/{mbid}` (메타 + pc1,pc2 + path)
  - `GET /songs/{mbid}/neighbors?k=10`
  - `GET /journeys?from=&to=&n=&mode=linear|axis`
  - `GET /nodes/{node_id}`, `GET /nodes/{node_id}/songs`
  - `GET /health` (번들 버전·로드 상태)
- 모든 응답에 `bundle`(예 `v2.2-pca16-2026-09-09`) 포함 — Backend 는 캐시 키에 넣는다. 오류 404/422/503.
- 로컬 개발: `infra/local/docker-compose.yml` 에 서비스 추가(팀 합의 후):
  ```yaml
  ai:
    build: ../../ai
    container_name: ody-local-ai
    environment: { ODY_SERVING_DIR: /data/serving, ODY_GRAPH_DIR: /data/graph, ODY_WORK: /data/work }
    volumes: [ "${ODY_AI_DATA:?required}:/data:ro" ]
    ports: [ "127.0.0.1:8000:8000" ]
    healthcheck: { test: ["CMD-SHELL", "curl -fs http://localhost:8000/health"], interval: 10s, retries: 30, start_period: 90s }
  ```
- 곡 식별자는 **MusicBrainz recording MBID(소문자 UUID)**. PostgreSQL 에 곡 테이블을 둘 경우 mbid 를 키로 하고, 제목·아티스트는 카탈로그(`title_raw`, `artist_raw`)에서 가져간다. AI 서비스는 좌표·이웃·여정만 책임진다.

---

## 7. 남은 일정 (09-09 수 ~ 09-13 일; 09-07 계획 대비 2일 밀림 — 화·수 작업 미착수)

| 날 | 할 일 | 완료 기준 |
|---|---|---|
| **09-09 수** | `data/` 생성·복사·첫 커밋(§1) · 데이터 전송 시작(§2, 12GB) · 길이 규칙 v4 + `flag_instrumental` dry-run → **v2.2** (`artifact_finalize.py` 해시) → `check_contract --strict --prev` · CURRENT→v2.2 | 팀 저장소에 `data/` 커밋, v2.2 PASS, `pytest -q data/tests` 통과 |
| **09-10 목** | `retrieval/` artifact·postprocess·neighbors·search + `api.py` 이웃·검색·곡 3개 엔드포인트 · 벤치 | p95 ≤ 50ms, 제외 곡 0, Hit@10 ±5% |
| **09-11 금** | `journey.py`(linear, axis, far·n) · `tree.py` · 엔드포인트 3개 · Dockerfile · app-node 수동 기동 · Backend 연동 확인 | 100쌍 여정 100% 응답 p95 ≤ 2s, 5,461 노드 200 |
| **09-12 토** | Spark S2~S6 (8.8GB 입력, 표본 10만 → 전곡) 패리티 · `spark/README.md` | 좌표 오차 < 1e-4, 리프 100%, 제외 집합 동일 |
| **09-13 일** | 버퍼 · 부하(k6 smoke 는 팀 `infra/k6` 형식) · 롤백 리허설(v2.1↔v2.2) · README/문서 | 체크리스트 전부 ✓ |
| 09-14 월 | 배포 | — |

컷 순서(뒤처지면): Spark 전곡(표본 패리티만) → `mode=axis` → 텍스트 검색 FTS(LIKE 만) → 트리 대표곡 → 평가 잡. **자르지 않는 것**: 제외 곡 미노출, 후처리 규칙, far 표시, 계약 검사.

---

## 8. 팀에 확인할 것 (답 없으면 괄호 안 가정으로 진행)

1. HDFS 여유 용량과 app-node `/data` 여유 디스크 (가정: HDFS ≥ 30GB, app-node ≥ 5GB 여유).
2. app-node 에서 AI 컨테이너에 줄 수 있는 RAM (가정: 2GB. 부족하면 그래프 k=10 슬림 + 정확 kNN 폴백만).
3. AI 서비스 배포 방식 — 수동 `docker run` 허용 여부, Jenkins job 추가 시점 (가정: 1차 수동, `ops/verify/` 에 `ai.sh` 추가).
4. Backend 의 AI 프록시 경로 prefix (가정: `/api/ai/...` 를 Backend 가 받아 `ody-ai:8000` 으로 전달).
5. Neo4j "graph projection" 의 대상 — 곡 이웃 그래프인가, 사용자/플레이리스트 그래프인가 (가정: 1차 AI 는 Neo4j 미사용).
6. `.gitignore` 에 §1 의 AI 대용량 패턴 추가 승인.

---

## 9. 실행 명령 모음

```bash
# 계약 검사 (data/ 에서)
PYTHONUTF8=1 .venv/Scripts/python.exe tests/check_contract.py serving/v2.1-pca16
PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest -q tests
# 카탈로그 규칙 dry-run → apply (승인 후)
PYTHONUTF8=1 .venv/Scripts/python.exe pipeline/run.py --stage s1_dryrun
PYTHONUTF8=1 .venv/Scripts/python.exe pipeline/run.py --stage s1_apply --approve "승인"
# 검색 서비스 (예정)
uvicorn retrieval.api:app --host 0.0.0.0 --port 8000
# Spark (master-node, 예정)
spark-submit --master yarn --deploy-mode client --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g spark/jobs/preprocess.py --in hdfs:///ody/data/raw_features_extracted --out hdfs:///ody/data/features_pre --sample 100000
```

---
출처: Kakao Entertainment, melon (www.melon.com) · MLHD+ (MetaBrainz Foundation) · MusicBrainz canonical dump 2026-08-17
