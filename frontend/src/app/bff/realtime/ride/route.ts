import { failLive, okLive } from "@/lib/api-response";
import { backendDelete, backendPost, BackendError } from "@/lib/backend";
import type { ApiErrorCode, DismountResponse, RideResponse } from "@/types";

/**
 * 따라가기 = **탑승** (S15P21A405-530) — **실연동**. 탑승과 하차가 같은 경로의 다른 메서드다.
 *
 * 구독(`/bff/users/follow/*`)과 다른 기능이다. 구독은 오래 남는 관계이고, 탑승은 지금 이 순간
 * 남의 탐색을 그대로 따라다니는 것이다.
 *
 * **호출자 토큰으로 부른다.** 이 API 는 **누가** 타는지가 곧 내용이라 서비스 토큰으로 부르면
 * 전부 한 사람이 탄 게 된다 — `backendFetch` 가 요청의 Authorization 을 그대로 넘긴다
 * (S15P21A405-481).
 */

/**
 * 거부 사유를 그대로 올린다 (백엔드 `RealtimeErrorCode`).
 *
 * **상태 코드로 뭉치지 않는다.** 409 하나에 "인솔자가 곡 위에 없다" · "이미 타고 있다" ·
 * "자리가 찼다" 가 전부 들어 있어서, 상태만 보면 화면이 안내 문구를 고를 수 없다.
 */
const RIDE_CODES = new Set<string>([
  "RIDE_CAPTAIN_INACTIVE",
  "RIDE_SELF",
  "RIDE_ALREADY_RIDING",
  "RIDE_CHAIN_FORBIDDEN",
  "RIDE_FULL",
  "RIDE_NOT_RIDING",
  "RIDE_NOT_CAPTAIN",
  "RIDE_STALE",
  "PRESENCE_ERROR",
]);

function rideCode(code: string): ApiErrorCode {
  return RIDE_CODES.has(code) ? (code as ApiErrorCode) : "INTERNAL_ERROR";
}

/** 탑승. 인솔자가 서 있는 곡으로 옮겨지고, 그가 듣던 위치부터 재생이 이어진다 */
export async function POST(req: Request) {
  const upstream = "/api/realtime/ride";
  try {
    const body = (await req.json()) as { captainEmail: string };
    return okLive(await backendPost<RideResponse>(upstream, body), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(rideCode(err.code), err.message, err.status || 502, upstream);
  }
}

/**
 * 하차. **본문이 없다** — 누가 내리는지는 토큰이 말한다.
 *
 * 성공 응답에 남게 된 자리가 실려 온다. `backendDelete` 는 `data` 가 null 이어도 실패로 보지
 * 않는 통로라 반환 타입이 `unknown` 이다. 여기서만 좁힌다.
 */
export async function DELETE() {
  const upstream = "/api/realtime/ride";
  try {
    return okLive((await backendDelete(upstream)) as DismountResponse, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(rideCode(err.code), err.message, err.status || 502, upstream);
  }
}
