import { ok } from "@/lib/api-response";

/**
 * POST /api/feedback — 설문 응답 수집 (S15P21A405-250).
 *
 * **목 라우트다.** 지금은 받은 걸 서버 콘솔에 찍고 성공만 돌려준다.
 * 백엔드 저장 API 가 준비되면 **이 파일 안만** 실제 호출로 바꾸면 된다 —
 * 화면 코드는 한 줄도 바뀌지 않는다 (`src/lib/backend.ts` 의 `backendGet` 참고).
 *
 * 받는 값은 `SurveySubmission` 이다. 검증을 느슨하게 두는 이유: 문항과 단계가
 * 바뀔 수 있어서 이유·응답값을 고정 목록으로 못박으면 문항을 고칠 때마다
 * 여기도 고쳐야 한다.
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* 본문이 없거나 JSON 이 아니면 그대로 진행 — 목이라 막지 않는다 */
  }

  // 개발 중 무엇이 실제로 전송되는지 확인하는 용도
  console.log("[survey]", JSON.stringify(body));

  return ok({ received: true });
}
