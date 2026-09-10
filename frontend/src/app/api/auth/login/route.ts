import { fail, ok } from "@/lib/api-response";
import { emailError } from "@/lib/auth-rules";
import { findAccount, tokenFor } from "@/mocks/auth";

/** 이메일·비밀번호 로그인 (AUTH-02, 목) */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email ?? "";
  const invalid = emailError(email);
  if (invalid) return fail("VALIDATION_ERROR", invalid, 400);

  const acc = findAccount(email);
  // 어느 쪽이 틀렸는지 알려주지 않는다 (계정 존재 여부가 새어 나가지 않게)
  if (!acc || acc.social || acc.password !== (body.password ?? "")) {
    return fail("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않아요.", 401);
  }
  return ok({ accessToken: tokenFor(acc.email) });
}
