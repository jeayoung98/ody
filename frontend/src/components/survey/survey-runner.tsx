"use client";

import { useEffect, useMemo } from "react";
import { SURVEY_MIN_LISTEN_MS } from "@/constants/survey";
import { useJourneyRouteQuery } from "@/hooks/queries/use-journey-route-query";
import { useNearbyQuery } from "@/hooks/queries/use-nearby-query";
import { sendUnanswered } from "@/hooks/survey/use-survey-submit";
import { useJourneyTargets, useNearbyTargets } from "@/hooks/survey/use-survey-targets";
import { SURVEY_FORCED, useSurveyTrigger } from "@/hooks/survey/use-survey-trigger";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useSurveyStore } from "@/stores/use-survey-store";
import SurveyCard from "./survey-card";
import { GENRE_NAMES } from "@/constants/map";
import type { MapPoint } from "@/types/map";

/** 이웃 한 곡에서 카드가 쓸 것만 뽑는다. 커버는 아직 응답에 없어서 비어 있다 */
function toTrack(p: MapPoint) {
  return { musicId: p.musicId, title: p.title, artist: p.artist, genreId: p.genreId };
}

/** 장르 이름 → ID. 이름표에 없으면 색을 고르지 않는다(중립색) */
function indexOfGenre(name: string): number | null {
  const i = GENRE_NAMES.indexOf(name as (typeof GENRE_NAMES)[number]);
  return i < 0 ? null : i;
}

/**
 * 설문 본체 (S15P21A405-294).
 *
 * `SurveyGate` 가 **동적으로 불러온다** — 플래그가 꺼진 빌드에서는 이 모듈이 아예 로드되지
 * 않는다. 그래서 설문 관련 import(스토어·훅·카드)가 전부 이 경계 안에 있어야 한다.
 *
 * 의존은 한 방향이다 — 설문이 기존 스토어·쿼리를 **읽기만** 한다. 기존 코드는 설문을 모른다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyRunner() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const context = usePlayerStore((s) => s.context);
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);

  const beginListening = useSurveyStore((s) => s.beginListening);
  const noteListened = useSurveyStore((s) => s.noteListened);
  const elapsedMs = useSurveyStore((s) => s.elapsedMs);
  const markSent = useSurveyStore((s) => s.markSent);
  const hasSent = useSurveyStore((s) => s.hasSent);

  /**
   * 같은 탐색 결과를 설문도 읽는다. 화면이 이미 받아 둔 캐시라 새 요청이 나가지 않는다
   * (`staleTime` 안이면 TanStack Query 가 같은 데이터를 돌려준다).
   */
  const nearby = useNearbyQuery(viewMode === "nearby" ? nearbyCenterMusicId : null);
  const inJourney = context.kind === "journey";
  const journey = useJourneyRouteQuery(
    inJourney ? context.startMusicId : null,
    inJourney ? context.endMusicId : null,
    inJourney,
  );

  /** 이웃 응답(`MapPoint`)은 장르 ID 를 그대로 준다 */
  const nearbyTargets = useNearbyTargets(
    useMemo(() => (nearby.data ? toTrack(nearby.data.center) : undefined), [nearby.data]),
    useMemo(() => nearby.data?.neighbors.map(toTrack), [nearby.data]),
  );
  /** 정거장은 장르를 이름으로 준다 — 색을 고르려면 ID 가 필요해서 이름표에서 되찾는다 */
  const journeyTargets = useJourneyTargets(
    useMemo(
      () =>
        journey.data?.stops.map((s) => ({
          musicId: s.id,
          title: s.title,
          artist: s.artist,
          genreId: s.genreName == null ? null : indexOfGenre(s.genreName),
        })),
      [journey.data],
    ),
  );

  /** 지금 듣는 곡이 평가 대상인가. 경로 재생 중이면 경로 표, 주변 탐색 중이면 주변 표에서 찾는다 */
  const table = inJourney ? journeyTargets : viewMode === "nearby" ? nearbyTargets : null;
  const prompt = currentMusicId != null && table ? (table.get(currentMusicId) ?? null) : null;

  /**
   * 곡별 청취 시간을 장부에 쌓고, **20초를 못 채우고 떠난 곡은 무응답 행으로 보낸다.**
   *
   * 곡이 바뀌는 순간(cleanup)이 유일한 기회다. 그때 얼마나 들었는지가 확정되고, 그 뒤로는
   * 그 곡이 화면에서 사라져 다시 물을 수도 보낼 수도 없다.
   *
   * 스킵한 곡을 통째로 빼면 정밀도가 실제보다 좋게 나온다 — 짧게 듣고 넘긴 곡이야말로
   * 추천이 틀렸을 가능성이 높기 때문이다. 그래서 묻지 않고 행만 남긴다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    const from = Date.now();
    const left = prompt?.target ?? null;
    // 카드가 재생 도중에 뜬다 — 그때 "지금까지 몇 초"를 알려면 시작 시각이 스토어에 있어야 한다
    beginListening(currentMusicId, from);

    const settle = (skipped: boolean) => {
      const listenedMs = elapsedMs(currentMusicId); // 마감 전에 읽는다 — 이번 체류가 포함돼야 한다
      noteListened(currentMusicId, Date.now() - from);
      if (!left || hasSent(left)) return;
      // 20초를 넘겼으면 설문이 떠 있다 — 그건 카드가 제출로 처리한다
      if (!SURVEY_FORCED && listenedMs >= SURVEY_MIN_LISTEN_MS) return;
      sendUnanswered({ target: left, listenedMs, skipped });
      markSent(left);
    };

    // 탭을 닫거나 숨기면 곡이 바뀌지 않는다 — 그 자리에서 정리해 보낸다
    const onLeave = () => settle(false);
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("pagehide", onLeave);
      settle(true); // 곡이 바뀐 것은 사용자가 넘긴 것으로 본다
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMusicId, prompt?.target.sessionId, prompt?.target.rank]);

  useSurveyTrigger(prompt);

  return <SurveyCard />;
}
