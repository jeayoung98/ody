"use client";

import { useState } from "react";
import { journeyEdge, nearbyEdge, type Trail } from "./edge-rules";
import type { SurveyEdge, SurveySong } from "@/types/survey";

/**
 * 간선 판정에 `sessionId` 를 붙여 주는 껍데기 (S15P21A405-294 · 335).
 *
 * 규칙 자체는 `edge-rules.ts` 에 있다 — 여기는 목록이 바뀔 때 세션을 새로 만드는 일만 한다.
 */

/**
 * `sessionId` 를 목록 단위로 붙들어 둔다.
 *
 * 탐색 1회가 세션 1개이고, 그 안에서 곡마다 `rank` 가 붙는다. 둘이 합쳐 **행의 자리**가 된다
 * (서버 `UNIQUE(session_id, rank)`). 같은 답을 두 번 받지 않는 기준은 이것이 아니라
 * 문항 키다 (`questionKey`, S15P21A405-346) — 같은 탐색을 다시 열면 세션이 새로 생긴다.
 *
 * **곡을 고를 때마다 새로 만들면 안 된다.** 한 번의 탐색이 여러 세션으로 쪼개져
 * "이 탐색에서 몇 곡을 평가했나"를 셀 수 없게 된다. 그래서 목록이 바뀔 때만 새로 만든다.
 */
function useSessionId(signature: string | null): string | null {
  // 목록이 바뀔 때만 새 세션을 만든다 (effect 안 setState 대신 "adjusting state during render")
  const [held, setHeld] = useState<{ signature: string; sessionId: string } | null>(null);

  if (signature != null && held?.signature !== signature) {
    setHeld({ signature, sessionId: crypto.randomUUID() });
  }
  return signature != null && held?.signature === signature ? held.sessionId : null;
}

/** 지금 켜진 주변 결과에서 간선을 푸는 함수. 결과가 아직 없으면 늘 null 이다 */
export function useNearbyEdges(center: SurveySong | null | undefined, neighbors: readonly SurveySong[] | undefined) {
  const signature = center && neighbors?.length ? `nearby:${center.musicId}:${neighbors.map((n) => n.musicId).join(",")}` : null;
  const sessionId = useSessionId(signature);

  return (musicId: number, trail: Trail): SurveyEdge | null =>
    sessionId == null || !center || !neighbors ? null : nearbyEdge(musicId, trail, { sessionId, center, neighbors });
}

/** 지금 듣는 여정에서 간선을 푸는 함수 */
export function useJourneyEdges(stops: readonly SurveySong[] | undefined) {
  const signature = stops?.length ? `journey:${stops.map((s) => s.musicId).join(",")}` : null;
  const sessionId = useSessionId(signature);

  return (musicId: number, trail: Trail): SurveyEdge | null =>
    sessionId == null || !stops ? null : journeyEdge(musicId, trail, { sessionId, stops });
}
