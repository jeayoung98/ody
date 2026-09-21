import { fail, failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, callerAuth, emailFromToken, toUser, type BackendUserDetail } from "@/lib/backend";

/**
 * 내 정보 (AUTH-02) — **배포 백엔드 실연동** (S15P21A405-462).
 *
 * **백엔드에 본인 조회 API 가 없다** (BACKEND-NOTES A-15). 그래서 액세스 토큰의 `sub`(= 이메일)를
 * 꺼내 사용자 상세를 대신 읽는다. 토큰 자체의 검증은 그 요청을 받은 백엔드가 한다.
 *
 * 토큰이 없으면 401 이다 — 설문 모드처럼 계정 없이 도는 화면에서도 마찬가지고, 그쪽은
 * 마이페이지 입구가 닫혀 있어서(`FEATURES.profile`) 이 응답을 기다리지 않는다.
 */
export async function GET(req: Request) {
  const email = emailFromToken(req);
  if (!email) return fail("UNAUTHENTICATED", "인증이 필요합니다.", 401);

  const upstream = `/api/user/detail?email=${encodeURIComponent(email)}`;
  try {
    const data = await backendGet<BackendUserDetail>(upstream, { headers: callerAuth(req) });
    return okLive(toUser(data), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
