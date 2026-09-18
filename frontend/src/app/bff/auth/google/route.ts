import { backendProxy } from "@/lib/backend";

/**
 * 구글 idToken 로그인 (AUTH-01/02) — **배포 백엔드 실연동** (S15P21A405-462).
 *
 * 예전에는 `/api/auth/login/google` 을 브라우저가 직접 불렀는데, 로컬에서는 그 경로가
 * `live-api-paths.ts` 에 없어 닿지 않았고 넣어도 `Origin` 때문에 403 이었다 (S15P21A405-303).
 * 다른 인증 경로와 같이 BFF 를 거친다.
 */
export const POST = (req: Request) => backendProxy(req, "/api/auth/login/google");
