import { backendProxy } from "@/lib/backend";

/**
 * 로그아웃 — **배포 백엔드 실연동** (S15P21A405-462).
 * 백엔드가 토큰을 무효화하고 refresh 쿠키를 지우는 `Set-Cookie` 를 준다. 그걸 그대로 넘겨야
 * 브라우저에서도 쿠키가 사라진다 — 프론트가 로컬 토큰만 지우면 재발급으로 되살아난다.
 */
export const POST = (req: Request) => backendProxy(req, "/api/auth/logout");
