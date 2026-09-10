# specs/ — 스펙 주도 개발(SDD) 규약 + 하네스 지도

기능 하나 = 폴더 하나. 파일 세 개.

| 파일 | 답하는 질문 | 누가 검토 |
|---|---|---|
| `spec.md` | **무엇**을 만들고, **언제 끝났다고** 하나 (수용 기준 AC1.. 은 기계로 검사 가능한 문장) | 사람(재영) — 여기만 꼼꼼히 |
| `plan.md` | **어떻게**: 데이터 계약, 인터페이스, 의존, 성능 예산, 리스크 | 사람은 계약·인터페이스만 |
| `tasks.md` | 순서 있는 작업 단위, 각각 **완료 조건**(테스트 이름 또는 산출 파일) | 에이전트가 체크 |

## 작업 루프
1. spec 작성(사람 또는 에이전트 초안 → 사람 승인). 수용 기준 없는 스펙은 시작하지 않는다.
2. plan → tasks 는 에이전트가 쓰고 사람은 계약·인터페이스만 확인.
3. tasks 하나씩 구현. 완료 조건 = 통과하는 테스트. 테스트 없는 완료 조건은 산출 파일 경로.
4. `git commit` 시 훅이 `pytest -q -x data/tests` 실행. 실패면 커밋 불가.
5. spec 변경은 커밋으로 남긴다(왜 바꿨는지 한 줄). 결정은 `DECISIONS.md` 에 날짜·번호. 재론 금지, 바꾸려면 새 번호.

상태 표기: ⬜ 미착수 · 🔶 진행 · ✅ 완료 · ⛔ 보류.

## 하네스 — 무엇이 무엇을 막는가

| 층 | 파일 | 막는 것 | 언제 도는가 |
|---|---|---|---|
| 규칙 | `data/AGENTS.md` (`data/CLAUDE.md` 가 import) | 스펙 없는 코드, 재학습, 개별 곡 제외, 하드코딩 임계값 | 에이전트 세션 시작 |
| 스펙 | `specs/*/spec.md` 수용 기준 | "끝났다"의 자의적 판정 | 작업 시작 전 등록 |
| 게이트 | `gates/*.json` | 사후 기준 수정 (실험·승격 판정) | 승격 전 |
| 계약 | `tests/check_contract.py`, `test_contract.py` | 스키마·해시·버전 규칙 위반 번들 승격 | 커밋 훅 + 승격 명령 |
| fixture | `tests/conftest.py` (`root` `current` `bundle_dir` `rules`) | 번들 없는 머신에서 거짓 실패 — `bundle_dir` 가 skip | 모든 테스트 |
| 단위 | `tests/test_*.py` | 규칙 로직 회귀(접힘·상한·길이·마스킹·폴백) | 커밋 훅 |
| 패리티 | `tests/test_spark_parity.py`(스펙 20) | Spark 결과가 numpy 기준과 다른 것 (좌표 1e-4, 리프 100%, 제외 집합) | 표본 → 전곡, 수동 |
| 벤치 | `tests/bench_*.py` → `output/*.json` | 성능 AC 미달 (p95 50ms / 2s / 20ms) | 배포 전, 수동 |
| 훅 | `.claude/settings.json`(git 밖, 키트 설치) → `data/scripts/hooks/pre_commit_gate.sh` | 테스트 실패 커밋 | `git commit` 직전 |
| Jira | `.claude/hooks/require-jira*.sh`(git 밖, 키트 설치) | Jira Key 없는 브랜치의 파일 수정·commit·push | 파일 수정·`git commit` 직전 |
| 운영 검증 | `ops/verify/ai.sh`(2차), `/health` | 번들 버전·로드 상태 불일치 | 배포 후 |

대용량 데이터 없는 머신에서는 계약 테스트가 skip 된다. 완전 검증은 데이터 볼륨이 붙은 개발 머신에서만 유효하다.

## 스펙 목록

번호 대역: `0x` 계약·기반 · `1x` 서빙 기능 · `2x` Spark · `3x` 평가 · `4x` 2차 · `5x` 저장소.

| 폴더 | 내용 | Jira | 1차 배포(09-14) | 목표일 |
|---|---|---|---|---|
| `00_artifact_contract` | 서빙 아티팩트 스키마·버전·해시 계약 — 모든 트랙의 기준 | — | 필수 | 09-09 (v2.2 strict) |
| `01_mock_artifact` | 목업 번들 — FE·BE 선행 개발 잠금 해제 | S15P21A405-32 | 필수 | 09-10 |
| `10_retrieval_neighbors` | 이웃 검색 라이브러리 + API | S15P21A405-39 | 필수 | 09-10 |
| `11_journey` | 여정(직선 기본 / 축 우선 옵션 / 먼 곡 처리) | — | 필수 | 09-11 |
| `12_tree_explore` | 트리 탐색 API (읽기) | — | 필수 | 09-11 |
| `13_genre_hierarchy` | 장르 대분류·미분류 격리 (소분류는 코드표 부재로 보류) | S15P21A405-36 | 컷 후보 | 미정 |
| `14_axis_labels` | PC1~PC4 축 라벨 + 사람 검수 (노드별 축은 보류) | S15P21A405-38 | 컷 후보 | 미정 |
| `15_playability` | 외부 서비스 매핑률 실측 · playable 컬럼 | S15P21A405-40 | 컷 후보 | 미정 |
| `16_map_layer_serving` | map_layer·track_position 적재 (쓰기) | S15P21A405-37 | 필수 | 미정 |
| `18_db_ingest` | music·genre·music_genre + Neo4j 적재 5단계 (D11) | S15P21A405-125 | 인프라 상향 대기 | 미정 |
| `20_spark_pipeline` | 전처리·PCA·카탈로그 Spark 이식 + 패리티 | — | 필수(패리티 기준) | 09-12 |
| `30_eval_jobs` | 아티팩트 버전별 자동 평가 | — | 있으면 좋음 | 컷 후보 |
| `40_popularity_tier` | 비인기 티어(D5) | — | ⛔ 2차 | 배포 후 |
| `50_db_schema` | data 소유 테이블 DDL·마이그레이션 | S15P21A405-90 | 팀 결정 대기 | 미정 |

12 와 16 의 경계: **12 는 읽기 API, 16 은 적재**다. 같은 값을 두 경로로 계산하므로 16 의 AC7 이 두 값의 일치를 검사한다.

일정·컷 순서는 `../docs/plan_release1.md`, 팀 통합은 `../docs/HANDOVER_TEAM.md`.
