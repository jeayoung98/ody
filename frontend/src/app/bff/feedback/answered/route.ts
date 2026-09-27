import { ok, okLive, failLive } from "@/lib/api-response";
import { backendGet, BackendError, isBackendEnabled } from "@/lib/backend";
import { isLoopbackBackend, shouldPersistSurvey } from "@/lib/survey-persistence";

/**
 * GET /bff/feedback/answered — 이미 답한 설문 문항 (S15P21A405-346).
 *
 * **왜 필요한가**: 백엔드가 같은 사람 × 같은 문항을 한 번만 저장한다. 프론트가 그걸 모르면
 * 방금 답한 것을 또 묻고 서버는 저장하지 않고 조용히 버린다 — 사용자에게는 같은 질문이
 * 두 번 뜨는 고장으로 보인다. 그래서 시작할 때 한 번 받아 둔다.
 *
 * **브라우저가 백엔드를 직접 못 부른다.** 배포 백엔드가 `Origin` 이 붙은 요청을 전부
 * `403 Invalid CORS request` 로 막아서(BACKEND-NOTES B-17) rewrite 로 흘려보내도 403 이 된다.
 * 그래서 여기서 서버가 대신 부른다 — 서버 요청에는 `Origin` 이 없다.
 *
 * 인증을 요구하지 않는다. 1차 배포는 로그인 없이 받으므로 사람 구분은 `anonymousId` 가 한다.
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const anonymousId = requestUrl.searchParams.get("anonymousId");
  if (!anonymousId) return ok([]);

  const upstream = `/api/feedback/answered?anonymousId=${encodeURIComponent(anonymousId)}`;

  // 저장하지 않는 테스트 세션은 운영 DB의 기존 응답도 읽지 않는다.
  if (!shouldPersistSurvey({
    backendEnabled: isBackendEnabled(),
    hostname: requestUrl.hostname,
    localTestDatabase: process.env.SURVEY_TEST_DATABASE === "local"
      && isLoopbackBackend(process.env.BACKEND_ORIGIN),
  })) return ok([]);

  try {
    return okLive(await backendGet<unknown[]>(upstream), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.status === 400 ? "INVALID_INPUT" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
