import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { withFollow, withFollowInList } from "@/lib/optimistic";
import { snapshotQueries } from "@/lib/query-snapshot";
import { API_ENDPOINTS, CHANGED, FOLLOW_FAILED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import type { FollowListResponse, FollowResponse, User, UserProfile } from "@/types";

/**
 * 팔로우 = **구독** (S15P21A405-489, BACKEND-NOTES A-37·A-38). **실연동이다** — 목이었다.
 *
 * **탑승(ride)과 다르다.** 예전에는 이 훅 이름이 `useStartFollowMutation` 이고 주석이
 * "따라가기 시작" 이었는데, 실제로 부르던 목은 `{ok:true}` 만 주는 자리표시자였다. 백엔드에서는
 * 구독(`/api/user/follow/*`)과 탑승(`/api/realtime/ride`)이 처음부터 다른 기능이다 — 구독은
 * 오래 남는 관계이고 탑승은 지금 이 순간 남의 탐색을 따라다니는 것이다.
 *
 * 응답의 `followeeFollowerCnt` 는 **바뀐 뒤** 값이라 화면이 다시 조회하지 않고 바로 쓸 수 있다.
 * 그래도 조회를 무효화하는 것은 같은 화면의 다른 값(`isFollowing` 등)을 맞추기 위해서다.
 *
 * **사용자 조회를 통째로 무효화한다** (S15P21A405-577). 예전에는 상대 프로필 하나만 지웠는데,
 * 구독 하나가 바뀌면 최소 네 군데가 같이 틀어진다 — 상대의 팔로워 수, **내 팔로잉 수**,
 * 그리고 양쪽의 팔로워·팔로잉 목록(`isFollowing` 이 보는 사람 기준이라 남의 목록도 바뀐다).
 * 어느 것이 화면에 떠 있는지 여기서는 알 수 없고, 사용자 조회는 작아서 다시 읽어도 싸다.
 *
 * **누르는 순간 버튼과 수가 바뀐다** (S15P21A405-675). 상대 프로필의 `isFollowing`·팔로워 수, 내 프로필의
 * 팔로잉 수, 떠 있는 팔로워·팔로잉 목록의 그 사람 줄을 먼저 고치고, 실패하면 전부 되돌린다.
 * 응답 뒤 무효화는 그대로다 — 서버 값으로 다시 맞춘다.
 */
export function useFollowMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (followeeEmail: string) =>
      api<FollowResponse>(API_ENDPOINTS.user.followInsert, { method: "POST", body: JSON.stringify({ followeeEmail }) }),
    onMutate: (followeeEmail) => applyFollow(qc, followeeEmail, true),
    onSuccess: () => {
      showToast(CHANGED.followed);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
    onError: (_e, _email, restore) => {
      restore?.();
      showToast(FOLLOW_FAILED);
    },
  });
}

/** 구독 상태를 캐시에 먼저 적는다. 돌려주는 함수가 되돌리기다 */
async function applyFollow(qc: QueryClient, email: string, follow: boolean) {
  const restore = await snapshotQueries(qc, [QUERY_KEYS.user.all]);
  const me = qc.getQueryData<User>(QUERY_KEYS.auth.me)?.email;
  qc.setQueryData<UserProfile>(QUERY_KEYS.user.profile(email), (prev) => withFollow(prev, follow, "target"));
  if (me) qc.setQueryData<UserProfile>(QUERY_KEYS.user.profile(me), (prev) => withFollow(prev, follow, "me"));
  qc.setQueriesData<FollowListResponse>({ queryKey: QUERY_KEYS.user.followListAll }, (prev) => withFollowInList(prev, email, follow));
  return restore;
}

/** 구독 해제. **팔로우 중이 아니어도 200** 이라 화면이 상태를 먼저 확인할 필요가 없다 */
export function useUnfollowMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (followeeEmail: string) =>
      api<FollowResponse>(API_ENDPOINTS.user.followDelete, { method: "POST", body: JSON.stringify({ followeeEmail }) }),
    onMutate: (followeeEmail) => applyFollow(qc, followeeEmail, false),
    onSuccess: () => {
      showToast(CHANGED.unfollowed);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
    onError: (_e, _email, restore) => {
      restore?.();
      showToast(FOLLOW_FAILED);
    },
  });
}
