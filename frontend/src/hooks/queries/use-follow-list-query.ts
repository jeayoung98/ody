import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import type { FollowListResponse } from "@/types";

/**
 * 팔로워·팔로잉 목록 (S15P21A405-489, BACKEND-NOTES A-39).
 *
 * `isFollowing`·`meetingCnt` 는 목록 소유자가 아니라 **보고 있는 나** 기준이다.
 * 비공개 사용자의 목록은 본인만 볼 수 있어 `USER_PRIVATE` 가 올 수 있다.
 */
export function useFollowListQuery(email: string, type: "follower" | "following", page = 0, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.user.followList(email, type, page),
    queryFn: () => api<FollowListResponse>(API_ENDPOINTS.user.followList(email, type, page)),
    enabled: enabled && !!email,
  });
}
