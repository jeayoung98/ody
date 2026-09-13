"use client";

import { useEffect, useRef } from "react";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 큐(여정·플리) 재생 중 곡이 끝나면 다음 곡으로 넘긴다 (S15P21A405-258).
 *
 * ## ⚠️ 곡 길이 타이머는 임시다
 *
 * 앱이 음원을 직접 재생하지 않아 **곡이 끝나는 시점을 알 수 없다.** 그래서 백엔드가 주는
 * `duration`(초)만큼 기다렸다가 넘긴다. 사용자가 유튜브 탭에서 멈춰도 이 시계는 계속 돈다.
 *
 * **규칙 6 이 2026-09-13 에 개정돼 공식 플레이어 임베드가 허용됐다** (S15P21A405-290).
 * 막힌 건 데이터뿐이다 — 응답의 `videoId` 가 아직 전부 `null` 이고, 확보·적재는 별도 이슈다.
 * **`videoId` 가 들어오기 시작하면 이 타이머를 IFrame Player 의 `ended` 이벤트로 바꾼다.**
 * 그때 설문의 청취 시간도 실제 재생 시간으로 같이 바꾼다.
 *
 * ## 막는 창이 떠 있으면 기다린다
 *
 * 답을 강제하는 창(설문 등)이 떠 있으면 넘기지 않는다. 그 동안 시계도 멈췄다가, 창이 닫히면
 * 남은 시간만큼 이어서 센다 — 답하느라 쓴 시간이 곡 재생 시간에서 깎이면 안 된다.
 * 무엇이 막고 있는지는 여기서 모른다 (`use-blocking-store` 참고).
 */
export function useQueueAutoAdvance() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const next = usePlayerStore((s) => s.next);
  const blocked = useBlockingStore((s) => s.blockers.size > 0);

  // 플레이어바가 이미 부르는 쿼리다 — 캐시에 있어서 새 요청이 나가지 않는다
  const { data } = useMusicDetailQuery(currentMusicId);
  const durationMs = data?.duration != null && data.duration > 0 ? data.duration * 1000 : null;

  /** 이 곡을 "재생 중"으로 보낸 시간. 멈춰 있거나 막혀 있는 동안은 안 쌓인다 */
  const spent = useRef(0);

  useEffect(() => {
    spent.current = 0; // 곡이 바뀌면 처음부터
  }, [currentMusicId]);

  const hasNext = queue.length > 0 && queueIndex + 1 < queue.length;

  useEffect(() => {
    if (currentMusicId == null || durationMs == null || !hasNext) return;
    if (!isPlaying || blocked) return;

    const from = Date.now();
    const id = setTimeout(() => {
      spent.current = durationMs;
      next();
    }, Math.max(0, durationMs - spent.current));

    return () => {
      clearTimeout(id);
      spent.current += Date.now() - from; // 멈춘 지점까지만 쌓고 다음에 이어간다
    };
  }, [currentMusicId, isPlaying, blocked, durationMs, hasNext, next]);
}
