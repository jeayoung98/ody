# ODY Frontend

React 19.2, TypeScript 6, Vite 8 기반 SPA다. Node.js `24.20.0`과 npm `11.19.0`을
`.nvmrc`, `package.json`, lockfile, Jenkins build image에서 동일하게 고정한다.

## Local development

Backend와 local dependencies를 먼저 실행한다.

```bash
python scripts/local/dev.py init
python scripts/local/dev.py up
python scripts/local/dev.py backend
```

다른 terminal에서 Frontend를 실행한다.

```bash
cd frontend
nvm use
npm ci
npm run dev
```

Vite는 `http://127.0.0.1:5173`에서 실행되며 `/api`를 기본적으로
`http://localhost:8080`에 proxy한다. 다른 Backend 주소가 필요할 때만 `DEV_API_TARGET`을 바꾼다.

## Checks

```bash
npm ci
npm run lint
npm test
npm run build
```

`VITE_API_BASE_URL`은 Browser bundle에 포함되는 공개 설정이다. 기본값과 운영값은 모두 `/api`다.
`VITE_*` 변수에 credential, token, private key 또는 서명 secret을 넣지 않는다. 실제 `.env*` 파일은
Git에서 제외하고 공개 가능한 변수 이름과 기본값만 `.env.example`에 기록한다.
