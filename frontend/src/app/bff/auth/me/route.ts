import { ok } from "@/lib/api-response";
import { accountAsUser, emailFromAuth, findAccount } from "@/mocks/auth";
import { mockMe } from "@/mocks/user";

/**
 * 내 정보 (AUTH-02). 목 토큰이 가리키는 계정이 있으면 그 계정을 돌려준다 —
 * 갓 가입한 계정은 `nickname: null` 이라 프론트가 닉네임 설정 화면으로 보낸다.
 */
export function GET(req: Request) {
  const email = emailFromAuth(req.headers.get("authorization"));
  const acc = email ? findAccount(email) : null;
  return ok(acc ? accountAsUser(acc) : mockMe());
}
