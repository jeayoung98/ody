"use client";

import { useMemo, useState } from "react";
import type { SurveyPrompt, SurveySong, SurveyTarget } from "@/types/survey";

/** 탐색 결과의 곡 하나. 전부 이미 받아 둔 탐색 응답 안에 있어서 새 요청이 없다 */
type Track = SurveySong;

/**
 * `sessionId` 를 목록 단위로 붙들어 둔다 (S15P21A405-294).
 *
 * 탐색 1회가 세션 1개이고, 그 안에서 곡마다 `rank` 가 붙는다. 둘이 합쳐 행의 식별자가 된다
 * (서버 `UNIQUE(session_id, rank)`).
 *
 * **곡을 고를 때마다 새로 만들면 안 된다.** 한 번의 탐색이 여러 세션으로 쪼개져
 * "이 탐색에서 몇 곡을 평가했나"를 셀 수 없게 된다. 그래서 목록(곡 ID 나열)이 바뀔 때만
 * 새로 만든다.
 */
function useSessionId(signature: string | null): string | null {
  // 목록이 바뀔 때만 새 세션을 만든다 (effect 안 setState 대신 "adjusting state during render")
  const [held, setHeld] = useState<{ signature: string; sessionId: string } | null>(null);

  if (signature != null && held?.signature !== signature) {
    setHeld({ signature, sessionId: crypto.randomUUID() });
  }
  return signature != null && held?.signature === signature ? held.sessionId : null;
}

/**
 * 주변 탐색 — 기준곡과 이웃 목록을 곡 ID 로 찾을 수 있는 표로 만든다.
 *
 * `rank` 는 이웃 순서 1부터다. 기준곡은 평가 대상이 아니라 표에 넣지 않는다.
 * 비교 상대는 늘 기준곡이라 보여줄 것도 하나로 같다.
 */
export function useNearbyTargets(center: Track | null | undefined, neighbors: readonly Track[] | undefined) {
  const signature = center && neighbors?.length ? `nearby:${center.musicId}:${neighbors.map((n) => n.musicId).join(",")}` : null;
  const sessionId = useSessionId(signature);

  return useMemo(() => {
    const table = new Map<number, SurveyPrompt>();
    if (sessionId == null || !center || !neighbors) return table;

    neighbors.forEach((n, i) => {
      const target: SurveyTarget = { sessionId, mode: "nearby", rank: i + 1, anchorMusicId: center.musicId, musicId: n.musicId };
      // 중심은 이웃을 몇 곡 듣든 안 바뀐다 — 후보가 늘 하나다
      table.set(n.musicId, { target, subject: n, candidates: [center] });
    });
    return table;
  }, [sessionId, center, neighbors]);
}

/**
 * 경로 탐색 — 정거장 목록을 표로 만든다.
 *
 * `rank` 는 정거장 step 이고 **출발곡(step 0)은 평가 대상이 아니다.** 앞 곡에서
 * 이어졌는지를 묻는 설문이라 비교할 앞 곡이 없기 때문이다.
 * 비교 상대는 정거장마다 다르다 — 바로 앞 역이다.
 */
export function useJourneyTargets(stops: readonly Track[] | undefined) {
  const signature = stops?.length ? `journey:${stops.map((s) => s.musicId).join(",")}` : null;
  const sessionId = useSessionId(signature);

  return useMemo(() => {
    const table = new Map<number, SurveyPrompt>();
    if (sessionId == null || !stops || stops.length < 2) return table;

    const anchorMusicId = stops[0].musicId;
    const targetMusicId = stops[stops.length - 1].musicId;
    stops.slice(1).forEach((stop, i) => {
      // slice(1) 이라 i=0 이 step 1 이다. 앞 역은 그 직전 정거장(stops[i])
      const target: SurveyTarget = {
        sessionId,
        mode: "journey",
        rank: i + 1,
        anchorMusicId,
        targetMusicId,
        prevMusicId: stops[i].musicId,
        musicId: stop.musicId,
      };
      // 비교 상대는 **바로 앞 역 하나뿐**이다. 그 역을 못 들었으면 묻지 않는다 —
      // 더 앞까지 거슬러 올라가면 경로에 없는 전환(1→3)을 평가하게 된다
      table.set(stop.musicId, { target, subject: stop, candidates: [stops[i]] });
    });
    return table;
  }, [sessionId, stops]);
}
