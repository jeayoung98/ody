import { ok } from "@/lib/api-response";
import { nicknameError } from "@/lib/auth-rules";
import { nicknameTaken } from "@/mocks/auth";

/** 닉네임 사용 가능 여부 (목). 백엔드 응답과 같은 모양 — available 하나만 준다 */
export function GET(req: Request) {
  const nickname = (new URL(req.url).searchParams.get("nickname") ?? "").trim();
  return ok({ available: !nicknameError(nickname) && !nicknameTaken(nickname) });
}
