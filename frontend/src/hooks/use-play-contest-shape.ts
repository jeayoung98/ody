"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, CONTEST_SKY_UNPLAYABLE, QUERY_KEYS } from "@/constants";
import { usePlaylistStarter } from "@/hooks/use-play-playlist";
import { api } from "@/lib/api";
import type { SkyShape } from "@/lib/contest-sky";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistDetail } from "@/types";

/**
 * 지도의 이벤트 작품을 누르면 그 플리를 튼다 (S15P21A405-684). 플리 화면의 재생과 같은 길이다 — 별자리도 켜진다.
 *
 * 플리 번호가 없으면(리더보드 응답에 아직 `playlistId` 가 없다, BACKEND-NOTES A-91) 틀 수 없다고 알린다.
 * 조회가 실패해도 같은 말을 한다 — 원본 플리가 지워졌을 수 있다(`artwork.playlist_id` 에 FK 가 없다).
 */
export function usePlayContestShape(): (shape: SkyShape) => void {
  const qc = useQueryClient();
  const start = usePlaylistStarter();
  const showToast = useToastStore((s) => s.show);

  return useCallback(
    (shape: SkyShape) => {
      const playlistId = shape.playlistId;
      if (playlistId == null) {
        showToast(CONTEST_SKY_UNPLAYABLE);
        return;
      }
      void qc
        .fetchQuery({ queryKey: QUERY_KEYS.playlist.detail(playlistId), queryFn: () => api<PlaylistDetail>(API_ENDPOINTS.playlist.detail(playlistId)) })
        .then((playlist) => start(playlist))
        .catch(() => showToast(CONTEST_SKY_UNPLAYABLE));
    },
    [qc, start, showToast],
  );
}
