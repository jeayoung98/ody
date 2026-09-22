import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { botAsProfile } from "@/lib/bots/adapt";
import { isBot } from "@/lib/bots/roster";
import { botLiveOf } from "@/stores/use-bot-store";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { UserProfile } from "@/types";

/**
 * 남(또는 내) 프로필.
 *
 * **봇이면 서버에 묻지 않고 지어서 돌려준다** (S15P21A405-536). 봇 계정은 DB 에 없어서
 * `GET /api/user/detail` 이 404 를 준다 — 목록에서 눌렀는데 오류 화면이 뜨면 봇이 "깨진 줄"
 * 처럼 보인다. 없는 값(탐험한 곡 수 등)은 지어내지 않고 `null` 로 둔다 (`lib/bots/adapt`).
 *
 * `staleTime: 0` 이 필요하다 — 봇이 곡을 바꾸거나 자리를 비우면 다시 계산해야 한다.
 */
export function useUserProfileQuery(email: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.user.profile(email ?? ""),
    queryFn: () => {
      if (!isBot(email)) return api<UserProfile>(API_ENDPOINTS.user.detail(email!));
      const bot = botLiveOf(email!);
      if (!bot) throw new Error("봇 명단에 없는 주소");
      return botAsProfile(bot);
    },
    enabled: !!email,
  });
}
