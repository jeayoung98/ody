import { backendProxy } from "@/lib/backend";

/**
 * 이메일·비밀번호 로그인 (AUTH-02) — **배포 백엔드 실연동** (S15P21A405-462).
 *
 * 응답을 가공하지 않고 그대로 넘긴다. 화면이 실패 코드(`INVALID_CREDENTIALS` ·
 * `PASSWORD_MISMATCH`)로 문구를 갈라 쓰고, refresh 쿠키도 백엔드가 심는 것을 그대로 전달해야 한다.
 */
export const POST = (req: Request) => backendProxy(req, "/api/auth/login");
