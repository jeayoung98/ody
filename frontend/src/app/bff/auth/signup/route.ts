import { backendProxy } from "@/lib/backend";

/**
 * 이메일·비밀번호 가입 (AUTH-01) — **배포 백엔드 실연동** (S15P21A405-462).
 * 본문 `{email, password, nickname}` 을 그대로 올린다. 형식·중복 검사는 백엔드가 하고,
 * 그 실패 코드(`INVALID_PASSWORD_FORMAT` · `EMAIL_ALREADY_EXISTS` …)를 화면이 그대로 쓴다.
 */
export const POST = (req: Request) => backendProxy(req, "/api/auth/signup");
