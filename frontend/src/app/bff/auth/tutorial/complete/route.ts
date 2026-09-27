import { failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError, callerAuth } from "@/lib/backend";

const UPSTREAM = "/api/user/tutorial-completed";

/**
 * 튜토리얼 완료 처리 — **배포 백엔드 실연동** (S15P21A405-462).
 * 백엔드는 `PATCH` 이고 본문이 없다. 누구의 튜토리얼인지는 토큰으로 정해지므로 호출자 자격으로 부른다.
 */
export async function POST(req: Request) {
  try {
    const data = await backendPatch<{ tutorialCompleted: boolean }>(UPSTREAM, {}, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
