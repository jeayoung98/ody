import { fail, ok } from "@/lib/api-response";
import { emailError, nicknameError, passwordError } from "@/lib/auth-rules";
import { createAccount, findAccount, nicknameTaken, tokenFor } from "@/mocks/auth";

/**
 * 이메일·비밀번호 가입 (AUTH-01, 목).
 * backend/dev 의 AuthService.signup 과 같은 순서·같은 에러 코드로 답한다 (S15P21A405-121).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; nickname?: string };
  const email = body.email ?? "";
  const password = body.password ?? "";
  const nickname = (body.nickname ?? "").trim();

  if (emailError(email)) return fail("INVALID_INPUT", "이메일 형식이 아닙니다.", 400);
  if (passwordError(password)) return fail("INVALID_PASSWORD_FORMAT", "비밀번호는 영문과 숫자를 포함해 8~72자여야 합니다.", 400);
  if (nicknameError(nickname)) return fail("INVALID_NICKNAME_LENGTH", "닉네임은 2~20자여야 합니다.", 400);
  if (findAccount(email)) return fail("EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다.", 409);
  if (nicknameTaken(nickname)) return fail("NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임입니다.", 409);

  const acc = createAccount(email, password, false, nickname);
  return ok({ accessToken: tokenFor(acc.email) });
}
