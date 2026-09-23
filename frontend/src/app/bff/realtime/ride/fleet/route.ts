import { failLive, okLive } from "@/lib/api-response";
import { backendDelete, BackendError } from "@/lib/backend";
import type { ApiErrorCode, DisbandResponse } from "@/types";

const UPSTREAM = "/api/realtime/ride/fleet";

/** 거부 사유를 그대로 올린다 — `../route.ts` 와 같은 이유. 해체에서 실제로 오는 것은 둘이다 */
const CODES = new Set<string>(["RIDE_NOT_CAPTAIN", "PRESENCE_ERROR"]);

/**
 * 선단 해체 = **강제 하차** (S15P21A405-606) — **실연동**. 백엔드 `DELETE /api/realtime/ride/fleet`.
 *
 * 인솔자가 따라오는 사람 전부를 내린다. 내린 사람들은 인솔자가 서 있는 곡에 그대로 남고
 * 듣던 곡도 끊기지 않는다. 인솔자 자신은 움직이지 않는다. **본문이 없다** — 누구의 선단인지는
 * 토큰이 말하므로 호출자 자격으로 부른다 (`backendFetch` 가 요청의 Authorization 을 그대로 넘긴다).
 * 따라오는 사람이 없으면 백엔드가 `RIDE_NOT_CAPTAIN` 으로 거부한다.
 */
export async function DELETE() {
  try {
    return okLive((await backendDelete(UPSTREAM)) as DisbandResponse, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive(CODES.has(err.code) ? (err.code as ApiErrorCode) : "INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
