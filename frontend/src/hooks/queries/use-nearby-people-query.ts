import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import type { NearbySnapshot } from "@/types";

/**
 * 주변 사람 목록 열기 (S15P21A405-482, 실시간 작업명세 §6.1).
 *
 * **뷰포트와 기준이 다르다.** 화면 범위가 아니라 **내가 듣는 곡과 비슷한 곡(최대 10곡)을 듣는
 * 사람**이고 가까운 순 목록이다. 좌표는 오지 않는다 — 지도에 찍지 않는다.
 *
 * **폴링하지 않는다.** 이 POST 한 번이 곧 실시간 구독 시작이고, 이후 변화는 `NEARBY_*` 델타로
 * 온다 (`use-nearby-people-live.ts`). `refetchInterval` 을 달면 구독이 매번 새로 열린다.
 *
 * **503 은 일시 실패다** (§12.7). 비슷한 곡 계산이 잠깐 실패한 것이고 영구 오류가 아니다.
 * 패널을 죽이지 말고 "다시 시도" 를 띄운다. 자동 재시도는 **1회**까지만 — 연타하면 서버에
 * 부담만 준다. 422(아직 아무 곡도 재생 안 함)와 404 는 재시도해도 같은 답이라 즉시 멈춘다.
 */
export function useNearbyPeopleQuery(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.realtime.nearby,
    queryFn: () => api<NearbySnapshot>(API_ENDPOINTS.realtime.nearby, { method: "POST" }),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (count, error) => count < 1 && (error as { code?: string }).code === "SERVICE_UNAVAILABLE",
    retryDelay: 2_500,
  });
}
