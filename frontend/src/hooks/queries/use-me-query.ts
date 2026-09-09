import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { User } from "@/types";

export function useMeQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: () => api<User>(API_ENDPOINTS.auth.me),
    staleTime: 5 * 60 * 1000,
  });
}
