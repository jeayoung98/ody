import { fail, ok } from "@/lib/api-response";

/**
 * POST /bff/music/{id}/report — 곡 신고 (S15P21A405-377).
 *
 * **목이다.** 백엔드에 아직 이 API 가 없다 (BACKEND-NOTES A-23). 실연동이 붙으면 여기서
 * 백엔드를 대신 부르고 `okLive` 로 답하게 바꾼다.
 *
 * **`okLive` 를 달지 않는다.** 그걸 달면 브라우저 콘솔이 "실데이터로 저장됐다" 고 말하게 되는데
 * 실제로는 아무 데도 안 남는다 — 목을 실데이터로 오해하는 것이 이 표식을 둔 이유와 정반대다
 * (`lib/api-response.ts`).
 *
 * 개발 콘솔에는 남긴다. 유저 테스트 중에 어떤 곡이 어떤 사유로 걸리는지 눈으로는 봐야 한다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const musicId = Number(id);
  if (!musicId) return fail("VALIDATION_ERROR", "곡 ID 가 올바르지 않습니다.", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_INPUT", "요청 본문이 JSON 이 아닙니다.", 400);
  }

  console.log("[report:mock]", musicId, JSON.stringify(body));
  return ok({ reportId: 0 });
}
