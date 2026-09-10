import { fail, ok } from "@/lib/api-response";
import { nicknameError } from "@/lib/auth-rules";
import { emailFromAuth, nicknameTaken, setNickname } from "@/mocks/auth";

/** 가입 직후 닉네임 확정 (AUTH-01, 목). 중복은 저장하지 않는다 */
export async function PATCH(req: Request) {
  const email = emailFromAuth(req.headers.get("authorization"));
  if (!email) return fail("UNAUTHENTICATED", "로그인이 필요해요.", 401);

  const body = (await req.json().catch(() => ({}))) as { nickname?: string };
  const nickname = (body.nickname ?? "").trim();
  const invalid = nicknameError(nickname);
  if (invalid) return fail("VALIDATION_ERROR", invalid, 400);
  if (nicknameTaken(nickname)) return fail("NICKNAME_DUPLICATED", "이미 누가 쓰고 있는 닉네임이에요.", 409);

  const acc = setNickname(email, nickname);
  if (!acc) return fail("USER_NOT_FOUND", "계정을 찾을 수 없어요.", 404);
  return ok({ nickname: acc.nickname });
}
