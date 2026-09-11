import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, type ReactionKey } from "@/constants";

interface Input {
  toEmail: string;
  reactionKey: ReactionKey;
}

export function useSendReactionMutation() {
  return useMutation({
    mutationFn: ({ toEmail, reactionKey }: Input) =>
      api<{ ok: boolean }>(API_ENDPOINTS.user.reaction(toEmail), { method: "POST", body: JSON.stringify({ reactionKey }) }),
  });
}
