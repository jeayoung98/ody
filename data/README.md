# data/ — ODY 음악 지도 AI/Data 트랙 (BE4)

AcousticBrainz 660만 곡 좌표(PCA-16)·사분할 트리(깊이 6, 4,096 리프)·후처리 규칙을 서빙하는 Python 서비스와 Spark 이식.
현재 번들 `serving/v2.1-pca16`, 09-09 길이 규칙 반영 `v2.2-pca16` 예정. 배경은 `docs/HANDOVER_TEAM.md`, 실험 이력은 `docs/HANDOVER.md`.

## 읽는 순서
1. `AGENTS.md` — 규칙 · 2. `specs/README.md` — SDD 규약·하네스 · 3. `specs/00_artifact_contract/spec.md` — 인터페이스 · 4. `specs/DECISIONS.md` — D1~D6

## 실행
```bash
# 환경 (한 번)
python -m venv data/.venv && data/.venv/Scripts/pip install -r data/requirements.txt
# 대용량 데이터: data/work, data/serving/<v>/*.parquet|*.npz 를 볼륨·junction 으로 연결 (git 밖)

cd data
PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest -q tests                      # 단위·계약 (번들 없으면 계약 테스트 skip)
PYTHONUTF8=1 .venv/Scripts/python.exe tests/check_contract.py serving/v2.1-pca16   # 계약 검사
PYTHONUTF8=1 .venv/Scripts/python.exe pipeline/run.py --stage s1_dryrun       # 카탈로그 규칙 dry-run
```

## 구조
```
data/
├── AGENTS.md CLAUDE.md      # 에이전트 규칙 (CLAUDE.md 는 @AGENTS.md import)
├── specs/                   # SDD: 00 계약 · 10 이웃 · 11 여정 · 12 트리 · 20 Spark · 30 평가 · DECISIONS · README(하네스 지도)
├── spark/                   # Spark 이식 (spec 20): README(제출·자원) · jobs/{preprocess,pca,tree_assign,catalog_rules,artifact_export}
├── pipeline/                # 카탈로그 감사·제외 규칙 (numpy 기준 구현, Spark 패리티 기준값)
├── scripts/                 # 이식 원본 실험 코드(수정 금지) · hooks/pre_commit_gate.sh
├── gates/                   # 사전 등록 게이트 (기록 보존)
├── serving/                 # CURRENT.json + <version>/ (json·csv 만 git, parquet·npz 는 볼륨)
├── tests/                   # conftest(공용 fixture·skip) check_contract test_contract test_postprocess_rules · 신설: test_<모듈> bench_<모듈> test_spark_parity
├── output/                  # 벤치·리포트 json·md (README 참조)
└── docs/                    # HANDOVER plan_release1 qual_*
```
