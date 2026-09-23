"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { getMusicHint, getMusicHintOnServer, subscribeMusicHints } from "@/lib/music-hints";
import { resolveMusicLabel, type MusicLabel } from "@/lib/music-label";

/**
 * 곡 이름표 — **아는 즉시 보여 준다** (S15P21A405-585).
 *
 * 상세 조회가 오면 그 값을 쓰고, 오기 전에는 누를 때 넘겨받은 힌트를 쓴다 (`lib/music-hints`).
 * 둘 다 없을 때만 `Track <id>` 로 떨어진다 — 예전에는 그게 늘 첫 화면이었고, 제목은 응답이
 * 온 뒤에야 나타났다.
 *
 * 상세 조회를 여기서도 건다. 같은 키라 이미 그 곡을 부르고 있는 화면에서 요청이 더 나가지 않는다.
 */
export function useMusicLabel(musicId: number | null): MusicLabel {
  const { data } = useMusicDetailQuery(musicId);
  const hint = useSyncExternalStore(
    subscribeMusicHints,
    useCallback(() => getMusicHint(musicId), [musicId]),
    getMusicHintOnServer,
  );

  return resolveMusicLabel(musicId, data, hint);
}
