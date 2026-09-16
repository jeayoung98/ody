# ODY AI/Data 트랙 (BE4) — 에이전트 규칙

`data/` 는 AcousticBrainz 음악 지도(PCA-16, 깊이 6 사분할 트리)의 **Spark 파이프라인·카탈로그 규칙·DB 적재·평가** 코드다. 검색 서비스는 Backend 담당이다(D12).
팀 루트 `AGENTS.md` 는 인프라 전용이다. `data/` 안 작업은 이 파일을 따른다. 충돌 시 인프라 문서(`docs/infra/STATUS.md`)가 서버 사실을, 이 파일이 AI 코드 규칙을 결정한다.

## 개발 방식 — SDD
`specs/<기능>/spec.md`(무엇·수용 기준) → `plan.md`(어떻게·계약) → `tasks.md`(완료 조건 있는 작업) → 구현 → 훅이 `pytest` 실행.
**스펙 없는 기능 코드는 넣지 않는다. 수용 기준 없는 스펙은 시작하지 않는다.** 규약과 하네스 지도는 `specs/README.md`.

## 실행 환경
- Python 3.12, 가상환경 `data/.venv` (`python -m venv data/.venv && data/.venv/Scripts/pip install -r data/requirements.txt`).
- 항상 `PYTHONUTF8=1`. 파일 I/O 는 `encoding="utf-8"` 명시.
- 대용량은 git 밖: `data/work/`(junction 또는 `ODY_WORK`), `data/serving/<v>/*.parquet|*.npz`(볼륨 또는 `ODY_SERVING_DIR`), `data/data/`. 없으면 계약 테스트는 skip 된다(로컬 개발 머신에서만 완전 검증).
- 환경변수: `ODY_SERVING_DIR`, `ODY_WORK`. Backend 는 PostgreSQL(pgvector)·Neo4j 를 직접 조회한다(D12).

## 절대 규칙
1. **판정 기준은 측정 전에 등록**(`gates/*.json`, 스펙 수용 기준)하고 사후 수정하지 않는다. 틀렸으면 새 id 로 재등록하고 원 판정을 보존한다. 실패 게이트를 '보고 항목'으로 재분류하지 않는다.
2. **삭제 아님, 표시.** 카탈로그 제외는 `excluded`/`excluded_reason[]`/`flag_*` 컬럼으로만. 곡 개별 제외 금지, 규칙(`pipeline/exclusion_rules.json`)으로만.
   **단계를 쌓을 때는 입력 번들이 기준선이다**(2026-09-16, D18). 이전 단계가 이미 자른 행은 그 단계의 카탈로그가 보존하고, 다음 단계 카탈로그는 자기 입력의 전 행을 보존한다. 어느 단계 산출물인지는 `rules_hash` 와 번들 `manifest.json` 의 `songs_before_exclusion` 으로 식별한다. **전 단계 카탈로그는 지우지 않는다** (`work/catalog_v2_v3_2026-09-16.parquet` = v3 규칙 7,404,506행).
3. **fit·트리 재학습은 별도 결정.** 전처리·PCA·트리 파라미터는 `model_bundle.npz`/`split_axes.npz` 를 적용만 한다. 좌표가 바뀌면 major 버전이며 게이트 재등록.
4. **원본·특징·좌표 parquet·kNN 그래프는 커밋하지 않는다** (`.gitignore`). 검증 수치는 산출 코드와 같은 커밋에.
5. 정성(청취) 결과로 좌표·규칙을 즉석 수정하지 않는다. 관찰만 기록, 변경은 `specs/DECISIONS.md` 에 새 번호로.
6. 음원 파일 재생·다운로드·스크래핑 금지. 재생은 공식 플레이어 임베드(YouTube IFrame Player)로만 한다.
   `video_id` 확보 대상은 `map_sample` 과 검색 상위로 한정한다 — 전곡 적재는 D11 대로 하지 않는다.
   확보 조건: 곡 길이 ±3초(공식 채널은 ±30초) 일치 + `status.embeddable == true`. 미달이면 비워 둔다.
   `video_id` 없는 곡의 링크는 YouTube **검색** URL 만. (D15)
7. 출처 표기: Kakao Entertainment, melon (www.melon.com) · MLHD+ (MetaBrainz Foundation) · MusicBrainz canonical dump 2026-08-17.
8. 한국 곡 매칭은 한글 완전일치만. 로마자 추측 매칭 금지.
9. 후처리 임계값(τ_dup·artist_cap·τ_far·길이)은 `postprocess_rules.json` 에서 읽는다. 하드코딩 금지.
10. 자르지 않는 것: 제외 곡 미노출, 후처리 규칙, `far` 표시, 계약 검사, **Spark·Hadoop 클러스터 실행 증거**(D8 — HDFS 입출력 + `--master yarn` 제출, 스펙 20 AC0). 일정이 밀리면 `docs/plan_release1.md` 의 컷 순서대로 자른다. 자르는 것은 처리 범위이지 실행 환경이 아니다.

## 아티팩트
- 서빙 번들 `serving/<version>/` 하나로 함께 버전(좌표·트리·모델·규칙·manifest). 포인터 `serving/CURRENT.json`. git 에는 json·csv 만.
- 승격 전 `python tests/check_contract.py serving/<version> --strict --prev serving/<이전>` 통과 필수 (계약 `specs/00_artifact_contract/spec.md`).
- 현재 `v2.1-pca16`. 길이 규칙 60s~6min + `flag_instrumental` 반영 `v2.2-pca16` 예정(D1, D1b).

## 코드 위치
`spark/jobs/` Spark 이식(스펙 20) · `ingest/` DB 적재 CSV·스크립트(스펙 18) · `pipeline/` 카탈로그 감사·제외 규칙 numpy 기준 구현 · `scripts/` 재사용 실험 코드(이식 원본, 수정 금지) · `tests/` 단위·계약·패리티·벤치 · `gates/` 사전 등록 게이트 · `output/` 벤치·리포트 json · `docs/` 인수인계·계획·정성 기록.

## 훅
루트 `.claude/`(git 밖, 팀 배포 키트 `ody-jira-kit` 로 설치)의 훅: Jira-first — 브랜치에 `S15P21A405-\d+` 없으면 파일 수정·commit·push 차단(규칙 `.claude/rules/jira-workflow.md`, data 브랜치는 `data/<type>/<KEY>-<desc>`) · pytest 게이트 — `git commit` 이고 `data/` 변경이 있으면 `pytest -q -x data/tests` 를 먼저 돌린다. 실패 시 커밋 차단(exit 2). 우회하지 말고 테스트를 고친다. 비상용 `SKIP_COMMIT_GATE=1` 은 stderr 에 남는다.

## Backend 통합
**이웃 검색·여정·트리 탐색은 Backend(Spring) 담당이다**(D12, 2026-09-10 사용자 결정). data 는 서빙 API 를 제공하지 않는다. data 가 넘기는 것은 **DB 에 적재된 데이터**다: `music`(좌표 `location vector(16)` 포함)·`genre`·`music_genre` 662만 행(스펙 18), HNSW 인덱스(스펙 17), 레이어 GiST 인덱스와 `map_sample`(스펙 16, D14). 질의 예시와 함정은 `ingest/map_layer_queries.sql`. 곡 식별자는 MusicBrainz recording MBID(소문자 UUID). 후처리 임계값은 서빙 번들의 `postprocess_rules.json` 이 유일한 출처다(τ_dup 1.6624 · artist_cap 3 · τ_far 4.912 · 길이 30~1200s, 전부 L2 거리 기준).

## 검증·완료 보고
작업 완료 = tasks.md 의 완료 조건(테스트 이름 또는 산출 파일) 통과 + 상태 갱신(⬜→✅). 보고는 팀 형식: `변경 / 검증 / 남은 위험 / 롤백`.

## 커밋 메시지
형식의 단일 출처는 `.claude/rules/jira-workflow.md` 다. 이 절은 그 요약이며, 다르게 보이면 그쪽을 따르고 이 파일을 고친다.

```text
<type>: 한국어 한 줄 요약 + 핵심 수치 [S15P21A405-<번호>]
```
- `<type>` 은 **소문자**이고 **콜론을 바로 붙인다**: `feat` `fix` `refactor` `chore` `test` `docs` `ci` `style` `perf`. 스코프는 선택(`feat(spark): ...`).
- `Docs :` / `Docs:` / `docs :` 는 훅이 차단한다.
- Jira Key 는 대괄호로 끝에. 브랜치의 키와 같아야 한다.
- `Co-Authored-By` 트레일러는 넣지 않는다(팀 이력과 일치).

예: `feat: S5 카탈로그 제외 규칙 Spark 이식, 제외 780,107 [S15P21A405-128]`
