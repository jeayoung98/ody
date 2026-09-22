import { useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS, RIDE_REJECTED } from "@/constants";
import { api, ApiError } from "@/lib/api";
import { isBot } from "@/lib/bots/roster";
import { endRide } from "@/lib/realtime/ride";
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
 */
export async function dismountRide(): Promise<void> {
  /**
   * 봇에서 내리는 길 (S15P21A405-536). 서버는 내가 탄 적도 모르므로 `DELETE` 를 보내면
   * `RIDE_NOT_RIDING` 만 돌아온다. 자리는 지금 있는 곳 그대로다 — 봇을 따라다니는 동안
   * `use-bots` 가 내 위치를 계속 옮겨 뒀다.
   */
  if (isBot(useFollowStore.getState().leaderEmail)) {
    const map = useMapStore.getState();
    endRide({ musicId: map.myMusicId, layer: map.layer });
    return;
  }
  try {
    endRide(await api<DismountResponse>(API_ENDPOINTS.realtime.ride, { method: "DELETE" }));
  } catch (e) {
    /**
     * **`RIDE_NOT_RIDING` 은 조용히 넘긴다** (§3.3). 인솔자가 먼저 사라져 `RIDE_ENDED` 로 이미
     * 끝나 있던 경우인데, 사용자 입장에서는 눌러서 내려진 것이 맞다. 다만 자리 정보가 없으니
     * 지금 자리를 그대로 둔다 — `RIDE_ENDED` 가 이미 맞춰 놓았다.
     */
    const map = useMapStore.getState();
    if (useFollowStore.getState().leaderEmail) endRide({ musicId: null, layer: map.layer });
    throw e;
  }
}

function toastFor(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "UNKNOWN";
  // 이미 내려져 있던 것은 실패가 아니다. 정상 동작에 경고를 띄우지 않는다
  if (code === "RIDE_NOT_RIDING") return "";
  return RIDE_REJECTED[code as keyof typeof RIDE_REJECTED] ?? RIDE_REJECTED.UNKNOWN;
}
