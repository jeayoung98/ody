import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { FollowResponse } from "@/types";

/**
 * 팔로우 = **구독** (S15P21A405-489, BACKEND-NOTES A-37·A-38). **실연동이다** — 목이었다.
 *
 * **탑승(ride)과 다르다.** 예전에는 이 훅 이름이 `useStartFollowMutation` 이고 주석이
 * "따라가기 시작" 이었는데, 실제로 부르던 목은 `{ok:true}` 만 주는 자리표시자였다. 백엔드에서는
 * 구독(`/api/user/follow/*`)과 탑승(`/api/realtime/ride`)이 처음부터 다른 기능이다 — 구독은
 * 오래 남는 관계이고 탑승은 지금 이 순간 남의 탐색을 따라다니는 것이다.
 *
 * 응답의 `followeeFollowerCnt` 는 **바뀐 뒤** 값이라 화면이 다시 조회하지 않고 바로 쓸 수 있다.
 * 그래도 프로필 쿼리를 무효화하는 것은 같은 화면의 다른 값(`isFollowing` 등)을 맞추기 위해서다.
 */
export function useFollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (followeeEmail: string) =>
      api<FollowResponse>(API_ENDPOINTS.user.followInsert, { method: "POST", body: JSON.stringify({ followeeEmail }) }),
    onSuccess: (_d, email) => qc.invalidateQueries({ queryKey: QUERY_KEYS.user.profile(email) }),
  });
}

/** 구독 해제. **팔로우 중이 아니어도 200** 이라 화면이 상태를 먼저 확인할 필요가 없다 */
export function useUnfollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (followeeEmail: string) =>
      api<FollowResponse>(API_ENDPOINTS.user.followDelete, { method: "POST", body: JSON.stringify({ followeeEmail }) }),
    onSuccess: (_d, email) => qc.invalidateQueries({ queryKey: QUERY_KEYS.user.profile(email) }),
  });
}
