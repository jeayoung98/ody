import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { NearbySnapshot } from "@/types";

/**
 * 주변 사람 목록 열기 (S15P21A405-482, 실시간 작업명세 §6.1) — **실연동**. 본문 없음.
 *
 * 이 호출이 곧 실시간 구독 시작이라 **한 번만** 부른다. 폴링하면 구독이 매번 새로 열린다.
 */
export async function POST() {
  const upstream = "/api/realtime/nearby";
  try {
    return okLive(await backendPost<NearbySnapshot>(upstream, {}), upstream);
  } catch (e) {
    const err = e as BackendError;
    /**
     * **503 이 없어졌다** (S15P21A405-582). 이웃곡 계산이라는 단계가 사라져서 그 실패 상태
     * 자체가 없다 — 서버에서 코드를 지웠다. 남는 거부는 422 하나뿐이고, 아직 곡을 한 번도
     * 안 튼 경우다. 그때는 층도 자리도 없어서 목록을 만들 수 없다.
     */
    const code = err.status === 422 ? "PRESENCE_ERROR" : "INTERNAL_ERROR";
    return failLive(code, err.message, err.status || 502, upstream);
  }
}
