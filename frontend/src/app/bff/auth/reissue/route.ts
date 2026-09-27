import { backendProxy } from "@/lib/backend";

/**
 * access token 재발급 (B-8) — **배포 백엔드 실연동** (S15P21A405-462).
 *
 * 액세스 토큰은 30분짜리라 이게 없으면 새로고침할 때마다 로그인 화면으로 떨어진다.
 * 판단 근거는 httpOnly refresh 쿠키뿐이고, 프록시가 그 쿠키를 그대로 올려 준다
 * (백엔드가 `Path=/api/auth` 로 심는 것을 `backendProxy` 가 `/` 로 넓혀 두기 때문에 여기까지 실린다).
 */
export const POST = (req: Request) => backendProxy(req, "/api/auth/reissue");
