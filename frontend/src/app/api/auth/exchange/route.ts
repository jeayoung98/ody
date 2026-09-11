import { fail, ok } from "@/lib/api-response";
import { socialAccount, tokenFor } from "@/mocks/auth";

/**
 * OAuth code → accessToken 교환 (AUTH-02).
 * 목에서는 코드마다 구글 계정을 하나 만들어 둔다 — 첫 교환이면 닉네임이 비어 있어서
 * 프론트가 닉네임 설정 화면으로 보낸다 (실서비스는 백엔드가 신규 여부를 알려줘야 한다, BACKEND-NOTES A-14).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) return fail("VALIDATION_ERROR", "인증 코드가 없습니다.", 400);
  const acc = socialAccount(`${body.code.replace(/[^a-zA-Z0-9._-]/g, "") || "google"}@google.ody.app`);
  return ok({ accessToken: tokenFor(acc.email) });
}
