import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/constants";
import type { PlaySource } from "@/types";

interface RecordPlayInput {
  musicId: number;
  source: PlaySource;
  playedMs: number;
}

/** 재생 로그 기록 (play_history) */
export function useRecordPlayMutation() {
  return useMutation({
    mutationFn: ({ musicId, ...body }: RecordPlayInput) =>
      api<{ ok: boolean }>(API_ENDPOINTS.music.play(musicId), { method: "POST", body: JSON.stringify(body) }),
  });
}
