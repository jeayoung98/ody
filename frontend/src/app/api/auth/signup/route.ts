import { fail, ok } from "@/lib/api-response";
import { emailError, passwordError } from "@/lib/auth-rules";
import { createAccount, findAccount, tokenFor } from "@/mocks/auth";

/**
 * 이메일·비밀번호 가입 (AUTH-01, 목). 닉네임은 여기서 받지 않는다 —
 * 가입 직후 닉네임 설정 화면에서 따로 받는다 (PATCH /api/auth/nickname).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email ?? "";
  const password = body.password ?? "";
  const invalid = emailError(email) ?? passwordError(password);
  if (invalid) return fail("VALIDATION_ERROR", invalid, 400);
  if (findAccount(email)) return fail("EMAIL_DUPLICATED", "이미 가입된 이메일이에요.", 409);

  const acc = createAccount(email, password);
  return ok({ accessToken: tokenFor(acc.email) }, 201);
}
