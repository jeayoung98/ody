import { failLive, ok, okLive } from "@/lib/api-response";
import { backendPost, BackendError, isBackendEnabled } from "@/lib/backend";
import { isLoopbackBackend, shouldPersistSurvey } from "@/lib/survey-persistence";

/**
 * POST /bff/feedback — 탐색 설문 응답 저장 (S15P21A405-294).
 *
 * **브라우저가 백엔드를 직접 못 부른다.** 배포 백엔드가 `Origin` 이 붙은 요청을 전부
 * `403 Invalid CORS request` 로 막아서(BACKEND-NOTES B-17), rewrite 로 흘려보내도 403 이 된다.
 * 그래서 여기서 서버가 대신 부른다 — 서버 요청에는 `Origin` 이 없다.
 *
 * 몸통은 그대로 넘긴다. `verdict`·`reason` 조합 검증은 백엔드가 한다
 * (`CHECK ((verdict = false) = (reason IS NOT NULL))`) — 여기서 또 막으면 규칙이 두 곳이 된다.
 *
 * 인증을 요구하지 않는다. 1차 배포는 로그인 없이 받으므로 백엔드도 이 경로만 permitAll 이다.
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
export async function POST(req: Request) {
  const upstream = "/api/feedback";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return failLive("INVALID_INPUT", "요청 본문이 JSON 이 아닙니다.", 400, upstream);
  }

  /**
   * 목에서는 보내지 않고, 로컬에서는 명시적으로 연결한 로컬 DB에만 보낸다.
   *
   * 설문은 조회가 아니라 쓰기라서 테스트 응답이 `explore_feedback`에 섞이면
   * 비로그인 데이터에서 나중에 골라낼 방법이 없다.
   */
  const requestUrl = new URL(req.url);
  if (!shouldPersistSurvey({
    backendEnabled: isBackendEnabled(),
    hostname: requestUrl.hostname,
    localTestDatabase: process.env.SURVEY_TEST_DATABASE === "local"
      && isLoopbackBackend(process.env.BACKEND_ORIGIN),
  })) {
    console.debug("[survey:skipped] non-persistent test context");
    return ok({ feedbackId: 0 });
  }

  try {
    const data = await backendPost<{ feedbackId: number }>(upstream, body);
    return okLive(data, upstream);
  } catch (e) {
    const err = e as BackendError;
    // 백엔드 코드를 그대로 올리면 프론트 타입(ApiErrorCode)에 없는 값이 섞인다.
    // 400 은 입력 문제, 그 밖은 서버 문제로 좁혀서 넘긴다 — 원문 메시지는 그대로 남는다
    return failLive(err.status === 400 ? "INVALID_INPUT" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
