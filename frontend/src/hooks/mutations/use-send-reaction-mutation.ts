import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, type ReactionKey } from "@/constants";

interface Input {
  toEmail: string;
  reactionKey: ReactionKey;
}

/**
 * 반응 한 건 — `POST /api/realtime/reactions` (SOCIAL-02, S15P21A405-607). 응답 `data` 는 null 이다.
 * 소켓이 아니라 REST 인 이유는 따라가기와 같다 — 거부 사유(다른 층·쿨다운)가 보낸 사람에게 보여야 한다.
 */
export function useSendReactionMutation() {
  return useMutation({
    mutationFn: (body: Input) =>
      api<null>(API_ENDPOINTS.realtime.reactions, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
