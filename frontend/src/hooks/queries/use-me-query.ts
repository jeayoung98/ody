import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { User } from "@/types";

/**
 * 내 정보. 로그인하지 않았으면 **401 로 끝난다** — 그건 장애가 아니라 답이므로 재시도하지 않는다
 * (S15P21A405-462). 재시도하면 계정 없이 도는 설문 모드에서 화면이 몇 초씩 대기 상태에 머문다.
 */
export function useMeQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: () => api<User>(API_ENDPOINTS.auth.me),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
