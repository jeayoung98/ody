import { fail, ok } from "@/lib/api-response";
import { findAccount, tokenFor } from "@/mocks/auth";

/**
 * 이메일·비밀번호 로그인 (AUTH-02, 목).
 * 계정이 없거나 구글 전용 계정이면 INVALID_CREDENTIALS, 비밀번호만 틀리면 PASSWORD_MISMATCH —
 * backend/dev AuthService.login 과 같은 구분이다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const acc = findAccount(body.email ?? "");
  if (!acc || acc.social) return fail("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  if (acc.password !== (body.password ?? "")) return fail("PASSWORD_MISMATCH", "비밀번호가 올바르지 않습니다.", 401);
  return ok({ accessToken: tokenFor(acc.email) });
}
