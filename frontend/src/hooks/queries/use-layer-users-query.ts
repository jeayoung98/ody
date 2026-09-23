import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, LAYER_USERS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import type { LayerUsersSnapshot } from "@/types";

/**
 * 그 겹에서 재생 중인 사람 전부 (S15P21A405-537, BACKEND-NOTES §5).
 *
 * **여기는 폴링이 맞다.** 다른 실시간 조회들은 "한 번 부르면 구독이 열리고 이후는 델타" 라서
 * 폴링하면 구독이 매번 새로 열리는데, 이 API 는 **밀어 주는 이벤트가 아예 없다.**
 * 백엔드가 소켓 델타를 후속으로 두기로 해서, 그때까지는 다시 묻는 것 말고 방법이 없다.
 *
 * 겹이 키에 들어간다 — 겹을 옮기면 다른 목록이고, 키가 같으면 옮긴 직후에 이전 겹 사람이
 * 잠깐 남는다.
 *
 * **실패해도 지도는 돈다.** 사람이 안 보일 뿐 별과 조작은 그대로다. 그래서 재시도를 한 번으로
 * 묶고 오류를 화면에 띄우지 않는다 — 사용자가 할 수 있는 일이 없다.
 */
export function useLayerUsersQuery(layer: number, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.realtime.layerUsers(layer),
    queryFn: () => api<LayerUsersSnapshot>(API_ENDPOINTS.realtime.layerUsers(layer)),
    enabled,
    refetchInterval: LAYER_USERS.pollMs,
    /**
     * **안 보이는 탭에서는 쉰다.** 지도를 안 보고 있는데 10초마다 전 겹 사용자를 받아 봐야
     * 쓰는 데가 없다. 돌아오면 `refetchOnWindowFocus` 가 곧바로 한 번 채운다.
     */
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: LAYER_USERS.pollMs,
    retry: 1,
  });
}
