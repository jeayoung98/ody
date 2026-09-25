import { useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS, RIDE_DISBAND_REJECTED, RIDE_DISBANDED } from "@/constants";
import { api, ApiError } from "@/lib/api";
import { useFollowStore } from "@/stores/use-follow-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { DisbandResponse } from "@/types";

/**
 * 강제 하차 = 선단 해체 — `DELETE /api/realtime/ride/fleet` (S15P21A405-606).
 *
 * 내가 인솔자일 때 따라오는 사람 전부를 내린다. 인솔자인 나는 움직이지 않으므로 화면에서
 * 바꿀 것은 **인원수 0** 하나다 (`RIDE_RIDER_LEFT` 가 사람마다 따로 오지 않는다 — 해체는
 * 한 번에 끝나고, 내린 사람들에게만 `RIDE_ENDED` 가 간다).
 *
 * `RIDE_NOT_CAPTAIN` 은 여기서 "따라오는 사람이 없다" 는 뜻이다 — 누르는 사이 전원이 스스로
 * 내렸을 때다. 실패가 아니라 이미 원하는 상태이므로 인원도 0 으로 맞춘다.
 *
 * **누르는 순간 배너가 사라진다** (S15P21A405-675). 하차(674)와 같은 결이다 — 인원을 먼저 0 으로 두고,
 * 정말 실패했을 때만 누르기 전 인원으로 되돌린다.
 */
export function useDisbandMutation() {
  const showToast = useToastStore((s) => s.show);
  const setFollowerCount = useFollowStore((s) => s.setFollowerCount);
  return useMutation({
    mutationFn: () => api<DisbandResponse>(API_ENDPOINTS.realtime.rideFleet, { method: "DELETE" }),
    onMutate: () => {
      const before = useFollowStore.getState().followerCount;
      setFollowerCount(0);
      return before;
    },
    onSuccess: (res) => {
      setFollowerCount(0);
      showToast(RIDE_DISBANDED(res.riderCount));
    },
    onError: (e, _v, before) => {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      if (code !== "RIDE_NOT_CAPTAIN" && before != null) setFollowerCount(before);
      showToast(RIDE_DISBAND_REJECTED[code as keyof typeof RIDE_DISBAND_REJECTED] ?? RIDE_DISBAND_REJECTED.UNKNOWN);
    },
  });
}
