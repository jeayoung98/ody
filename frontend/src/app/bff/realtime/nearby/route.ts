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
     * **503 은 일시 실패다** (§12.7). 비슷한 곡 계산이 잠깐 안 된 것이고 영구 오류가 아니라,
     * 화면이 "다시 시도" 를 띄울 수 있게 코드를 구분해 올린다. 422 는 재생 기록이 없다는 뜻이다.
     */
    const code = err.status === 503 ? "SERVICE_UNAVAILABLE" : err.status === 422 ? "PRESENCE_ERROR" : "INTERNAL_ERROR";
    return failLive(code, err.message, err.status || 502, upstream);
  }
}
