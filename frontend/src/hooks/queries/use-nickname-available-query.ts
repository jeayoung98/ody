import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import { nicknameError } from "@/lib/auth-rules";

/** 닉네임 중복 확인 (AUTH-01). 형식이 맞을 때만 물어본다 */
export function useNicknameAvailableQuery(nickname: string) {
  const value = nickname.trim();
  return useQuery({
    queryKey: QUERY_KEYS.auth.nicknameAvailable(value),
    // 백엔드 응답은 NicknameAvailabilityResponse — available 하나뿐이다 (닉네임을 되돌려주지 않는다)
    queryFn: () => api<{ available: boolean }>(API_ENDPOINTS.user.nicknameAvailable(value)),
    enabled: !nicknameError(value),
    staleTime: 30 * 1000,
  });
}
