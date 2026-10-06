import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { UserProfile } from "@/types";

/** 남(또는 내) 프로필 */
export function useUserProfileQuery(email: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.user.profile(email ?? ""),
    queryFn: () => api<UserProfile>(API_ENDPOINTS.user.detail(email!)),
    enabled: !!email,
  });
}
