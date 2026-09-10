import { fail, ok } from "@/lib/api-response";
import { nicknameError } from "@/lib/auth-rules";
import { emailFromAuth, nicknameTaken, setNickname } from "@/mocks/auth";

/**
 * 구글 신규 사용자의 닉네임 확정 (AUTH-01, 목).
 * **백엔드에는 아직 이 엔드포인트가 없다** — BACKEND-NOTES A-13 으로 요청해둔 항목이다.
 */
export async function PATCH(req: Request) {
  const email = emailFromAuth(req.headers.get("authorization"));
  if (!email) return fail("UNAUTHENTICATED", "인증이 필요합니다.", 401);

  const body = (await req.json().catch(() => ({}))) as { nickname?: string };
  const nickname = (body.nickname ?? "").trim();
  if (nicknameError(nickname)) return fail("INVALID_NICKNAME_LENGTH", "닉네임은 2~20자여야 합니다.", 400);
  if (nicknameTaken(nickname)) return fail("NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임입니다.", 409);

  const acc = setNickname(email, nickname);
  if (!acc) return fail("USER_NOT_FOUND", "존재하지 않는 사용자입니다.", 404);
  return ok({ nickname: acc.nickname });
}
