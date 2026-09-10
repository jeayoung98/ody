@AGENTS.md

# ODY — 저장소 공통 가이드라인

이 파일은 **저장소 전체에 적용되는 규칙**이다. Claude Code, Codex 등 어떤 에이전트로 작업하든
파트를 가리지 않고 여기부터 읽는다. 파트별 상세 규칙은 각 폴더의 문서를 따른다.

| 범위 | 문서 |
| --- | --- |
| 저장소 전체 (이 파일) | 파트 소유권 · 기능 명세 동기화 · 계약 |
| **Jira-first 워크플로우 (이슈·브랜치·커밋 강제)** | [.claude/rules/jira-workflow.md](.claude/rules/jira-workflow.md) |
| 강제 훅 | [.claude/hooks/](.claude/hooks/) · 설정값 [.claude/jira-config.json](.claude/jira-config.json) |
| **팀 공통 규칙·명세 모음** | [docs/rules/](docs/rules/) |
| Git 컨벤션 (커밋 메시지 형식) | [docs/rules/CONVENTIONS.md](docs/rules/CONVENTIONS.md) |
| 기능 명세 (기준 문서) | [docs/rules/FEATURES.md](docs/rules/FEATURES.md) |
| ERD·API 협의 항목 | [docs/rules/BACKEND-NOTES.md](docs/rules/BACKEND-NOTES.md) |
| Frontend 코드 규칙 | [frontend/CLAUDE.md](frontend/CLAUDE.md) |
| Backend | [backend/README.md](backend/README.md) |
| Infra | [AGENTS.md](AGENTS.md), [docs/infra/](docs/infra/) |
| `data/` 안 작업 | `data/AGENTS.md` |

---

## 1. 파트 소유권 — 남의 폴더를 고치지 않는다

각 최상위 폴더에는 담당 파트가 있다. **자기 파트 밖의 파일은 읽기만 하고 고치지 않는다.**

| 폴더 | 담당 | 다른 파트가 할 수 있는 것 |
| --- | --- | --- |
| `frontend/` | Frontend | 읽기만 |
| `backend/` | Backend | 읽기만 |
| `ai/` | AI | 읽기만 |
| `infra/` `ops/` `observability/` `scripts/` `docs/infra/` | Infra | 읽기만 |
| `*/Jenkinsfile` `*/deploy.sh` | Infra | 읽기만 |
| `docs/` (infra 제외) | 공통 | 관련 파트가 수정 가능 |
| 저장소 루트 (`CLAUDE.md`, `AGENTS.md`, `.gitignore` 등) | 공통 | 변경 시 팀 공지 |

읽는 것은 언제나 자유다. 오히려 권장한다 — 상대 파트 코드를 봐야 계약이 맞는지 확인할 수 있다.

**남의 파트 파일을 고쳐야 하는 상황이 생기면, 고치지 말고 그 파트에 요청한다.**
답변에 "○○ 파트에 요청 필요" 문단을 만들어 무엇을 왜 바꿔야 하는지 적는다.

예외는 하나뿐이다. **명시적으로 그 파트 담당자가 요청했을 때**만 남의 폴더를 건드린다.
이때도 커밋을 섞지 않고 별도 브랜치·별도 MR로 낸다.

### 왜

- 같은 파일을 두 파트가 동시에 고치면 충돌이 나고, 누가 맞는지 판단할 사람이 없다.
- 배포 파이프라인(`Jenkinsfile`, `deploy.sh`)은 파트별 폴더 안에 있지만 **인프라 소유**다.
  프론트가 빌드 산출물 경로를 바꾸고 싶으면 인프라에 요청한다.

---

## 2. 브랜치 — Jira 이슈 없이 코드를 고치지 않는다

**절차의 기준은 [.claude/rules/jira-workflow.md](.claude/rules/jira-workflow.md) 다.** 이슈 검색·생성, 브랜치 생성,
"진행 중" 전환, 커밋·MR에 Key 넣기까지 그 문서를 따른다. `.claude/hooks/` 가 이를 강제하며 **훅을 우회하지 않는다.**
커밋 메시지 형식(`type: subject`, 소문자 type, 50자)은 [docs/rules/CONVENTIONS.md §1](docs/rules/CONVENTIONS.md) 이 기준이다.

```
master
├─ frontend  └─ frontend/<type>/<issue-key>-<description>
├─ backend   └─ backend/<type>/<issue-key>-<description>
├─ data      └─ data/<type>/<issue-key>-<description>
├─ infra     └─ infra/<type>/<issue-key>-<description>
└─ docs      └─ common/docs/<issue-key>-<description>
```

**커밋·브랜치 생성·push·MR 작성 전에 매번 확인한다.**

- 현재 브랜치가 `master` 또는 파트 통합 브랜치면 **직접 커밋·push 금지.** 작업 브랜치를 먼저 만든다.
- 작업 브랜치에는 Jira Issue Key(`S15P21A405-<번호>`)가 필수다. 브랜치는
  `bash .claude/hooks/new-branch.sh <part> <type> <KEY> <desc>` 로 만든다.
- 커밋 메시지에도 Key 를 넣는다: `feat: 주변 사용자 조회 API 구현 [S15P21A405-57]`
- 하나의 브랜치·MR = 하나의 이슈. 관련 없는 작업을 섞지 않는다.
- Jira 접근은 JAM MCP(`jira_search` / `jira_context` / `jira_full` / `jira_write_*`)만 쓴다. Issue Key 를 지어내지 않는다.
- 이슈가 필요 없는 요청: 코드 설명·읽기·구조 분석·질문 답변·`git status/log/diff/fetch`,
  그리고 `.claude/` · `.mcp.json` · `CLAUDE.md` 수정.

---

## 3. 기능 명세는 프론트·백이 같은 문서를 본다

기준 문서는 [docs/rules/FEATURES.md](docs/rules/FEATURES.md) 하나다.
프론트·백엔드·AI 모두 이 문서의 기능 ID(`SEARCH-01`, `PATH-01`, `SOCIAL-07` …)로 이야기한다.

### 코드를 쓰기 전에

1. FEATURES.md 에서 해당 기능 ID를 찾아 상세 설명대로 구현한다.
2. 요청이 명세와 다르거나 명세에 없으면 **바로 구현하지 않는다.** 어느 항목과 어떻게 다른지 짚어
   요청자에게 더블체크하고, "기능 명세와 다르므로 팀 상의가 필요하다"고 분명히 말한다.
3. 상대 파트의 계약(API 응답, 이벤트, 필드)이 걸린 기능이면 상대 파트 코드를 **읽어서** 실제
   구현과 맞는지 확인한다. 문서보다 배포된 코드가 최신일 수 있다.

### 명세가 바뀌어야 할 때 — 양쪽에 알린다

**한쪽만 바꾸고 끝내지 않는다.** 명세 변경은 반드시 반대편에 영향을 준다.

| 어디서 시작됐나 | 해야 할 일 |
| --- | --- |
| **백엔드가 바꿨다** (API 경로·응답 필드·에러 코드·정렬 기준 등) | 백엔드 담당은 FEATURES.md 해당 항목과 BACKEND-NOTES.md 를 갱신하고, **프론트에 "이 항목이 바뀌었으니 화면을 맞춰달라"고 알린다** |
| **프론트가 필요해졌다** (화면에 필요한 필드·새 API·소켓 이벤트 등) | 프론트 담당은 BACKEND-NOTES.md 에 항목을 추가하고, **백엔드에 "이 기능이 필요하니 API를 맞춰달라"고 알린다.** 없는 필드를 있는 척 구현하지 않는다 |
| **AI 모델 쪽이 바뀌었다** (좌표 차원·유사도 기준·대표곡 선별 등) | AI 담당은 FEATURES.md 의 지도·추천 항목을 갱신하고 **프론트·백엔드 양쪽에 알린다** |

에이전트가 이 상황을 감지하면 **작업을 마친 뒤 답변에 반드시 따로 짚어 알린다.** 조용히 넘어가지 않는다.

```text
상대 파트에 알려야 할 점
- [백엔드] MusicSummary.genres 가 이름 문자열만 내려옴 → 지도 별 색을 장르로 칠하려면 genreId 필요
- [프론트] 에러 코드가 명세의 VALIDATION_ERROR 가 아니라 INVALID_INPUT 으로 구현됨 → 프론트 타입 수정 필요
```

### 명세 문서 자체를 고칠 때

기획 담당자에게 **항목 하나씩** 확인을 받은 뒤 반영한다.
확인 전 제안은 FEATURES.md 하단 "변경 제안" 섹션에만 둔다.

---

## 4. 계약(Contract)이 걸린 것들

파트 경계를 넘는 것들이다. 한쪽이 바꾸면 **반드시** 반대편이 깨진다. 바꾸기 전에 상대에게 알린다.

| 계약 | 정의 위치 | 영향 |
| --- | --- | --- |
| 공통 응답 봉투 `{success, data, error}` | `backend/.../common/ApiResponse.java` ↔ `frontend/src/types/api.ts` | 전체 API |
| 에러 코드 | `backend/.../common/*ErrorCode.java` ↔ `frontend/src/types/api.ts` | 에러 처리 분기 |
| API 경로·요청·응답 | 백엔드 컨트롤러 ↔ `frontend/src/constants/api-endpoints.ts` | 해당 화면 |
| 인증 (Bearer + refresh 쿠키) | `backend/.../security/` ↔ `frontend/src/lib/api.ts` | 로그인 전체 |
| ERD·도메인 타입 | DB 스키마 ↔ `frontend/src/types/` | 데이터 표시 전반 |
| 소켓 이벤트 이름·페이로드 | `backend/.../config/WebSocketConfig.java` ↔ 프론트 소켓 핸들러 | 따라가기·실시간 |
| 빌드 산출물 경로 | `frontend/package.json` ↔ `frontend/Jenkinsfile`, `deploy.sh` | 배포 |
| PC 좌표 차원 수(16)·레이어 수(8) | AI 파이프라인 ↔ `frontend/src/constants/map.ts` | 지도 전체 |

---

## 5. 검증 없이 완료라고 하지 않는다

- 확인할 수 없는 항목을 성공했다고 단정하지 않는다.
- 테스트가 실패하면 실패했다고 그대로 말한다.
- 건너뛴 단계가 있으면 무엇을 왜 건너뛰었는지 밝힌다.

| 파트 | 최소 검증 |
| --- | --- |
| Frontend | `npm run lint` · `npm test` · `npm run build` |
| Backend | `./gradlew test` · `./gradlew build` |
| Infra | [AGENTS.md §6](AGENTS.md) |
