import { ok } from "@/lib/api-response";
import { nicknameError } from "@/lib/auth-rules";
import { nicknameTaken } from "@/mocks/auth";

/** 닉네임 중복 확인 (AUTH-01, 목). 형식이 틀린 값은 available=false 로 답한다 */
export function GET(req: Request) {
  const nickname = (new URL(req.url).searchParams.get("nickname") ?? "").trim();
  const available = !nicknameError(nickname) && !nicknameTaken(nickname);
  return ok({ nickname, available });
}
