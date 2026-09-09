@AGENTS.md

# ODY 프로젝트 — Frontend

Next.js 16 (App Router) · React 19 · Tailwind 4 · Zustand · TanStack Query · TypeScript

이 저장소는 팀 프로젝트 **ODY**의 frontend 파트다. **저장소 전체 공통 규칙(파트 소유권·브랜치·기능 명세 동기화)은 [루트 CLAUDE.md](../CLAUDE.md)가 기준이며, 코드를 쓰기 전에 항상 함께 읽는다.**

| 문서 | 언제 읽나 |
| --- | --- |
| [../CLAUDE.md](../CLAUDE.md) | 저장소 전체 공통 규칙. **모든 작업 전** |
| [docs/rules/FEATURES.md](../docs/rules/FEATURES.md) | 기능·화면 코드를 짜기 전 **항상** |
| [docs/rules/BACKEND-NOTES.md](../docs/rules/BACKEND-NOTES.md) | ERD·API·백엔드 전제가 걸리는 작업을 할 때. 새 항목이 생기면 **여기에 추가하고 사용자에게 보고** |
| [docs/rules/CONVENTIONS.md](../docs/rules/CONVENTIONS.md) | git 작업(브랜치·커밋·MR) 전 **항상** |

## 기능 명세 준수 (Claude용 — 코드 작성 요청마다 확인)

기능의 기준 문서는 [docs/rules/FEATURES.md](../docs/rules/FEATURES.md)다. **화면이나 기능 코드를 짜기 전에 항상 이 문서를 읽는다.**

- 요청이 명세에 있는 기능이면 명세의 상세 설명대로 구현한다.
- 요청이 명세와 다르거나 명세에 없는 기능이면 **바로 구현하지 않는다.** 요청한 개발자에게 어느 항목(ID)과 어떻게 다른지 짚어서 더블체크하고, "기능 명세와 다르므로 팀 전체와 상의가 필요하다"고 분명히 말한다. 개발자가 상의 후 진행하라고 하면 그때 구현하고, 명세 변경도 함께 제안한다.
- 명세 문서 자체를 수정할 때는 기획 담당자에게 **항목 하나씩** 확인을 받은 뒤 반영한다. 확인 전 제안은 문서 하단 "변경 제안" 섹션에만 둔다.
- 유저 플로우와 화면 구성의 세부(패널 구성, 뷰 모드 등)는 docs/rules/FEATURES.md의 UI 항목을 따른다.

## ERD·백엔드 영향 보고 (Claude용 — 매 작업마다 확인, 절대 생략 금지)

프론트만의 판단으로 넘어가면 안 되는 것들이다. 아래에 해당하면 **작업을 마친 뒤 답변에서 반드시 따로 짚어 알리고**, [docs/rules/BACKEND-NOTES.md](../docs/rules/BACKEND-NOTES.md)에 항목을 추가한다. 조용히 넘어가지 않는다.

### 반드시 알려야 하는 경우
1. **ERD 변경이 필요할 때** — 새 컬럼·테이블·제약이 필요하거나, 타입·NULL 허용·기본값이 지금 ERD와 맞지 않을 때. (예: `user.tutorial_completed` 추가)
2. **ERD에 없는 필드를 화면이 요구할 때** — 타입에 optional 로 넣어두고 "백엔드 확인 필요"로 보고한다. 있는 척 구현하지 않는다. (예: 앨범 커버, 작곡가, 무드)
3. **새 API가 필요하거나 기존 API 응답·파라미터가 바뀔 때** — 경로·요청·응답 형태를 적어 보고한다. 목 라우트(`src/app/api/`)를 만들었더라도 그것은 임시일 뿐이므로 반드시 보고한다.
4. **백엔드 계산·전송 방식에 전제를 두는 기능일 때** — 데이터 양, 전송 단위, 정렬·선별 기준, 실시간성 등. (예: 상주 집합 통째 전송, 레이어별 대표곡 선별, 16차원 거리 기반 경로 생성)
5. **소켓·실시간 이벤트가 필요할 때** — 따라가기 동기화, 접속 상태, 반응 전송 등.

### 보고 형식
답변 안에 "백엔드에 알려야 할 점" 문단을 두고, 각 항목마다 **무엇이 왜 필요한지**와 **없으면 무엇이 안 되는지**를 한 줄씩 쓴다. 그리고 같은 내용을 docs/rules/BACKEND-NOTES.md 표에 추가한다. 문서에는 상태(협의 전 / 협의 중 / 반영됨)를 함께 적는다.

### 타입 작성 규칙
- `src/types`의 도메인 타입은 **ERD를 그대로 옮긴 것**이 기준이다. ERD에 없는 필드를 추가할 때는 optional(`?`)로 두고 주석에 "ERD에 없음 — 백엔드 확인 필요"를 남긴다.
- ERD가 바뀌기로 확정되면 타입을 고치고, docs/rules/BACKEND-NOTES.md의 상태를 "반영됨"으로 바꾼다.

## Git 작업 시 필수 체크 (Claude용)

커밋, 브랜치 생성, push, MR/PR 작성을 하기 전에 아래를 **매번** 확인하고, 위반 사항이 있으면 실행하지 말고 사용자에게 먼저 알린다.

### 브랜치
- 현재 브랜치가 `master` 또는 파트 통합 브랜치 `frontend` 이면 **직접 커밋/push 금지**. 작업 브랜치를 먼저 만들 것.
- 작업 브랜치 형식: `frontend/<type>/<issue-key>-<description>`
  - type: `feat` `fix` `refactor` `test` `docs` `chore` `perf` (소문자)
  - issue-key: `S15P21A405-<번호>` 필수. 번호를 모르면 사용자에게 묻는다.
  - description: 영문 소문자 kebab-case
  - 예: `frontend/feat/S15P21A405-10-music-map`
- 브랜치 하나에 관련 없는 작업을 섞지 않는다.

### 커밋 메시지
- 형식: `type: subject` (type은 소문자, 콜론 앞 공백 없음, 뒤에만 공백 하나)
- type: `feat` `fix` `docs` `style` `refactor` `test` `chore` `config`
- Subject: 50자 이내, 마침표/특수기호 없음, 개조식. 영문이면 동사 원형 + 첫 글자 대문자 (`Add`, `Fix`, 과거형 금지)
- Body: 빈 줄 뒤에 **무엇을/왜** 바꿨는지 상세히
- Footer(선택): `Resolves: #n` / `Fixes: #n` / `Ref: #n` / `Related to: #n, #m`
- 예:
  ```
  feat: 음악 지도 화면 구현

  PCA 좌표 기반으로 곡을 2D 캔버스에 배치하고 클릭 시 재생

  Resolves: #10
  ```

### MR / PR
- 제목: `[S15P21A405-<번호>] 한글 설명` (Jira 이슈 제목과 동일하게)
- 대상 브랜치: 작업 브랜치 → `frontend`. `master` 로 직접 올리지 않는다.
- 하나의 MR은 하나의 Jira Issue만 다룬다.

## 프로젝트 구조

```
src/
  app/                    # App Router. 페이지(page.tsx)·레이아웃·API 라우트만. 컴포넌트를 두지 않는다
    page.tsx
    <route>/page.tsx
    api/                  # 목 API 라우트 (백엔드 연동 전)
  components/             # 모든 컴포넌트. 용도별 폴더로 분리
    common/               # 2개 이상 곳에서 쓰는 공통 UI (Box, Button, TrackRow, icons ...)
    layout/               # 화면 조립(main-screen) + 떠 있는 HUD (브랜드·레이어 스테퍼·검색·도움말·레일)
    map/                  # 별지도. engine/(좌표·카메라·재투영·모프·따라가기 순수 클래스), render/(캔버스 그리기·스프라이트)
    minimap/              # 좌하단 계기판 (미니맵·게이지·레이어 이름·축 나침반)
    player/               # 하단 트랜스포트·주변 탐색 버튼·반응 FAB
    panels/               # 우측 패널. song-detail/ playlist/ feed/ journey/ friends/ chart/
    tutorial/             # 튜토리얼 오버레이·카드·게이트
    auth/                 # 로그인 화면 조각
  hooks/
    queries/              # useQuery 훅. 파일당 하나, use-<name>-query.ts
    mutations/            # useMutation 훅. 파일당 하나, use-<name>-mutation.ts
  constants/              # 상수. query-keys.ts, api-endpoints.ts, map.ts, design-tokens.ts 등
  lib/                    # api 래퍼, storage, format 등 유틸
  mocks/                  # 목 데이터셋 (songs.ts 가 지도 곡 원본)
  providers/              # QueryProvider 등 클라이언트 Provider
  stores/                 # Zustand 스토어
  styles/                 # tokens.css (디자인 토큰)
  types/                  # ERD 기반 도메인 타입 (Music, User, Playlist ...)
docs/                     # 팀 컨벤션·기능 명세 문서
```

## 코드 컨벤션 (Claude용 — 코드 작성 시 매번 적용)

### 컴포넌트 분리
- **한 파일에 모든 것을 넣지 않는다.** 화면을 만들 때 페이지 컴포넌트는 레이아웃과 조립만 담당하고, 실제 UI 조각은 전부 별도 컴포넌트 파일로 뺀다.
- 분리 기준: 독립된 시각적 단위(카드, 리스트 아이템, 헤더, 폼 필드 등), 반복되는 JSX, 자체 상태나 훅을 가지는 부분은 무조건 컴포넌트로 분리한다. 애매하면 나눈다.
- 컴포넌트 파일 하나에는 컴포넌트 하나만 export 한다. 파일명은 kebab-case (`music-card.tsx`), 컴포넌트명은 PascalCase.
- **위치 규칙**
  - 컴포넌트는 전부 `src/components/` 아래에 둔다. `src/app/` 에는 page.tsx·layout.tsx·API 라우트만 남기고 컴포넌트 파일을 두지 않는다.
  - 2개 이상 곳에서 쓰는 범용 UI → `src/components/common/`
  - 그 외는 **용도별 폴더**로 나눈다: `layout/`(화면 조립·HUD) `map/` `minimap/` `player/` `panels/` `tutorial/` `auth/`. 새 용도가 생기면 폴더를 추가한다.
  - 한 용도 안에서 하위 묶음이 있으면 하위 폴더로 나눈다 (예: `panels/song-detail/`).
  - 용도별 폴더에 있던 것이 다른 용도에서도 쓰이게 되면 그 시점에 `common/`으로 옮긴다.

### TanStack Query
- 컴포넌트 안에서 `useQuery` / `useMutation`을 직접 호출하지 않는다. 반드시 커스텀 훅으로 감싸서 사용한다.
- 쿼리와 뮤테이션은 분리한다.
  - 조회: `src/hooks/queries/use-<name>-query.ts` (예: `use-music-detail-query.ts`)
  - 변경: `src/hooks/mutations/use-<name>-mutation.ts` (예: `use-create-playlist-mutation.ts`)
- 훅 파일 하나에 훅 하나. 관련 응답 타입은 `src/types` 도메인 타입을 쓰고, 훅 전용 타입만 훅 파일에 둔다.
- 뮤테이션 성공 시 무효화할 키는 `QUERY_KEYS`에서 가져온다.

### 상수
- 반복되거나 의미 있는 값은 전부 `src/constants/`에 상수로 뺀다. 매직 스트링/넘버를 코드에 직접 쓰지 않는다.
- 필수 상수 파일
  - `query-keys.ts` — 모든 쿼리 키. `QUERY_KEYS.<도메인>.<세부>` 형태, `as const` 필수
  - `api-endpoints.ts` — 모든 API 경로. `API_ENDPOINTS.<도메인>.<세부>`
  - 그 외 필요 시 `routes.ts`(페이지 경로), `storage-keys.ts`, `messages.ts` 등 주제별 파일 추가
- 상수명은 UPPER_SNAKE_CASE, 그룹 객체는 `as const`로 고정한다.
- `src/constants/index.ts`에서 re-export 하여 `import { QUERY_KEYS } from "@/constants"`로 쓴다.

### 디자인 토큰
- 색·폰트·반경·그림자 등 디자인 값은 `src/styles/tokens.css`(`@theme`)에만 정의한다. 컴포넌트에서 hex 값을 직접 쓰지 않고 `bg-glass`, `text-ink-2`, `border-line`, `rounded-box` 같은 토큰 유틸리티를 쓴다.
- canvas 등 JS에서 색이 필요하면 `src/constants/design-tokens.ts`를 쓴다. 두 파일은 같은 값을 미러링하므로 함께 고친다.
- 박스 형태 UI는 `Box`(글래스 패널)를, 반복되는 스타일은 `globals.css`의 `@utility`(glass / lbl / num / grad-bg / grad-text)를 재사용한다.
- 디자인 기준은 별지도 프로토타입(artifact 189966aa)이다. 풀스크린 캔버스 위에 글래스 HUD가 떠 있는 구성, 청록→파랑→보라 그라데이션, IBM Plex Sans KR / IBM Plex Mono / Familjen Grotesk 폰트.
- 예외: `src/components/common/icons.tsx`는 라인 아이콘 세트라 한 파일에 여러 컴포넌트를 둔다.

### 기타
- API 응답 타입은 `src/types`의 도메인 타입을 재사용한다. 필드명은 camelCase.
- 서버 상태는 TanStack Query, 클라이언트 전역 상태는 Zustand. 둘을 섞지 않는다.
- 백엔드 주소는 `NEXT_PUBLIC_API_URL` 환경변수로 주입한다 (`.env.example` 참고).

## 명령어
```
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
npx tsc --noEmit  # 타입 체크
```
