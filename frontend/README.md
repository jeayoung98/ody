# ODY Frontend

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Zustand · TanStack Query v5.

서버 기능(SSR·미들웨어·서버 액션)은 쓰지 않는다. 전 화면이 클라이언트 컴포넌트라
**정적 빌드로 내보내 nginx가 그대로 서빙한다** — 기존 배포 파이프라인(`Jenkinsfile`, `deploy.sh`)을 그대로 쓴다.

## Local development

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` 을 비워두면 `src/app/api/` 의 목 라우트로 붙고, 값을 주면 그 백엔드로 붙는다.
`.env.example` 을 복사해 `.env.local` 을 만든다.

```bash
npm run lint       # ESLint
npm test           # 타입 체크 (tsc --noEmit)
npm run build      # 프로덕션 빌드
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | 프로젝트 규칙 · 코드 컨벤션 |
| [docs/rules/FEATURES.md](../docs/rules/FEATURES.md) | 기능 명세 (기준 문서) |
| [docs/rules/BACKEND-NOTES.md](../docs/rules/BACKEND-NOTES.md) | ERD·API·백엔드 협의 항목 |
| [docs/rules/CONVENTIONS.md](../docs/rules/CONVENTIONS.md) | Git 컨벤션 |

## 구조

```
src/
  app/          # 페이지·레이아웃·목 API 라우트만 (컴포넌트를 두지 않는다)
  components/   # 용도별 폴더 (common/ layout/ map/ minimap/ player/ panels/ tutorial/ auth/)
  hooks/        # queries/ mutations/ — 파일당 훅 하나
  constants/    # 쿼리 키·API 경로·지도 상수·디자인 토큰
  stores/       # Zustand
  types/        # ERD 기반 도메인 타입
  mocks/        # 목 데이터셋
```
