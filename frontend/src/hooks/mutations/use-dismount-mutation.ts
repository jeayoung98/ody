import { useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS, RIDE_REJECTED } from "@/constants";
import { api, ApiError } from "@/lib/api";
import { endRide, leaveRideLocally } from "@/lib/realtime/ride";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { DismountResponse } from "@/types";

/**
 * 하차 — `DELETE /api/realtime/ride` (2차 실시간 명세 §3.2, S15P21A405-530).
 *
 * 본문이 없다. 누가 내리는지는 토큰이 말한다.
 *
 * **따라가는 동안 열려 있는 유일한 길이다** (§6). 나갈 수 없는 상태는 그 자체로 결함이라
 * 다른 조작이 전부 막힌 중에도 이것만 통과한다.
 */
export function useDismountMutation() {
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: () => dismountRide(),
    onError: (e) => {
      const message = toastFor(e);
      if (message) showToast(message);
    },
  });
}

/**
 * 버튼 밖에서 내려야 할 때 부르는 같은 요청 (ACT-01 활동 전환).
 *
 * 훅으로 감싸지 않은 이유는 부르는 자리가 콜백 안이기 때문이다 — 활동을 갈아탈 때
 * `use-start-activity` 가 이전 활동을 접는 그 지점에서 불러야 한다.
 *
 * **성공·실패 모두 화면의 탑승 상태를 걷어낸다.** 요청이 실패했는데 배너만 남으면 조작은
 * 잠긴 채 내릴 수도 없는 상태가 된다 — 그게 이 기능에서 제일 나쁜 결말이다.
 *
 * **누르는 순간 내린다** (S15P21A405-674). 예전에는 `DELETE` 응답이 올 때까지 우주선과 배너가 남아 있어
 * 버튼이 안 먹은 것처럼 보였다. 지금은 화면부터 내리고(`leaveRideLocally`), 응답은 자리(곡·겹)를 바로잡고
 * presence 를 다시 보내는 데만 쓴다. 그 사이 `RIDE_*` 알림이 와도 처리기가 `leaderEmail` 을 보고 흘려보낸다.
 */
export async function dismountRide(): Promise<void> {
  const wasRiding = useFollowStore.getState().leaderEmail != null;
  leaveRideLocally();
  try {
    endRide(await api<DismountResponse>(API_ENDPOINTS.realtime.ride, { method: "DELETE" }));
  } catch (e) {
    /**
     * **`RIDE_NOT_RIDING` 은 조용히 넘긴다** (§3.3). 인솔자가 먼저 사라져 `RIDE_ENDED` 로 이미
     * 끝나 있던 경우인데, 사용자 입장에서는 눌러서 내려진 것이 맞다. 다만 자리 정보가 없으니
     * 지금 자리를 그대로 둔다 — `RIDE_ENDED` 가 이미 맞춰 놓았다. 누르기 전에 타고 있었으면(화면은 이미
     * 내렸다) presence 만 다시 보내야 지도가 멈춘 채로 남지 않는다.
     */
    const map = useMapStore.getState();
    if (wasRiding) endRide({ musicId: null, layer: map.layer });
    throw e;
  }
}

function toastFor(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "UNKNOWN";
  // 이미 내려져 있던 것은 실패가 아니다. 정상 동작에 경고를 띄우지 않는다
  if (code === "RIDE_NOT_RIDING") return "";
  return RIDE_REJECTED[code as keyof typeof RIDE_REJECTED] ?? RIDE_REJECTED.UNKNOWN;
}
