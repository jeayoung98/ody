import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, PLAY_END } from "@/constants";
import type { PlayEndRequest } from "@/types";

/**
 * 재생 종료 (S15P21A405-482, 실시간 작업명세 §4.2).
 *
 * 위치는 바뀌지 않는다 — 들은 시간만 남긴다. 곡이 끝났을 때·다음 곡으로 넘어갈 때·정지할 때·
 * 탭을 닫을 때 보낸다. 여러 번 보내도 되고 마지막 값이 남는다.
 */
export function usePlayEndMutation() {
  return useMutation({
    mutationFn: (input: PlayEndRequest) =>
      api<null>(API_ENDPOINTS.music.playEnd, { method: "PATCH", body: JSON.stringify(clampPlayed(input)) }),
  });
}

/**
 * `playedMs` 를 합리적인 값으로 자른다 (§12.6).
 *
 * **큰 값을 넣으면 서버에서 실패한다.** 탭을 열어두고 방치한 뒤 종료를 보내면 경과시간이
 * 비정상적으로 커지는데, 그건 실제로 들은 시간이 아니다. 곡 길이를 알면 그걸로, 모르면
 * 상한으로 자른다. 음수도 막는다 — 400 `VALIDATION_ERROR` 다.
 */
export function clampPlayed({ playHistoryId, playedMs }: PlayEndRequest, durationMs?: number): PlayEndRequest {
  const ceiling = durationMs && durationMs > 0 ? Math.min(durationMs, PLAY_END.maxMs) : PLAY_END.maxMs;
  return { playHistoryId, playedMs: Math.max(0, Math.min(Math.round(playedMs), ceiling)) };
}
