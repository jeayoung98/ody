import { fail, ok } from "@/lib/api-response";

/** OAuth code → accessToken 교환 (AUTH-02). 목에서는 코드만 확인하고 가짜 토큰을 준다 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) return fail("VALIDATION_ERROR", "인증 코드가 없습니다.", 400);
  return ok({ accessToken: `mock-token-${body.code}` });
}
