"use client";

import { useEffect } from "react";
import Box from "@/components/common/box";
import { NO_GENRE_ID } from "@/constants";
import { useJourneyRouteQuery } from "@/hooks/queries/use-journey-route-query";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import JourneyEmptyPrompt from "./journey-empty-prompt";
import JourneySkeleton from "./journey-skeleton";
import JourneyStopList from "./journey-stop-list";
import JourneySummary from "./journey-summary";
import JourneyTop from "./journey-top";
import { analyticsContext, trackOnce } from "@/lib/analytics/client";
import { journeyResult } from "@/lib/analytics/flows";

/**
 * 여정 패널 (JOURNEY-01, PATH-01/02) — **결과를 보여주는 화면**이다.
 * 지점을 고치거나 경로를 만드는 일은 상단 확장 검색창에서만 한다.
 * 경로가 도착하면 **곧바로 별자리 뷰가 켜진다.** 이후에는 좌상단 `별자리 뷰` 택으로 껐다 켠다 (PATH-01).
 */
export default function JourneyPanel() {
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const isRouteRequested = useJourneyStore((s) => s.isRouteRequested);
  const route = useJourneyRouteQuery(startMusicId, endMusicId, isRouteRequested);
  const showConstellation = useMapStore((s) => s.showConstellation);

  const stops = route.data?.stops;
  const routeStart = route.data?.startMusicId;
  const routeEnd = route.data?.endMusicId;
  useEffect(() => {
    if (!isRouteRequested || startMusicId == null || endMusicId == null) return;
    if (route.isError) journeyResult(startMusicId, endMusicId, "error", 0);
    if (!route.data) return;
    const count = route.data.stops.length;
    journeyResult(startMusicId, endMusicId, count ? "success" : "empty", count);
    trackOnce(`journey-results:${analyticsContext().journey_id ?? `${startMusicId}-${endMusicId}`}`, "journey_results_viewed", {
      start_music_id: startMusicId, end_music_id: endMusicId, result_count: count,
    });
  }, [isRouteRequested, startMusicId, endMusicId, route.data, route.isError]);
  useEffect(() => {
    if (!stops || stops.length < 2 || routeStart == null || routeEnd == null) return;
    /**
     * 좌표를 함께 넘긴다. 경로 곡은 지도 상주 집합 밖일 수 있어 엔진이 좌표를 모르는데,
     * 그러면 별자리에 그려지지도 배치가 만들어지지도 않는다 (PATH-01).
     */
    showConstellation(
      stops.map((s) => s.id),
      stops.map((s) => ({ musicId: s.id, pc: s.pc, genreId: NO_GENRE_ID, weight: 1, title: s.title, artist: s.artist, youtubeUrl: null, playable: true })),
      // 목록이 어디서 왔는지 함께 남긴다 — 이 안의 곡을 누르면 단일 재생이 아니라 이 여정으로 이어진다
      { kind: "journey", startMusicId: routeStart, endMusicId: routeEnd },
    );
  }, [stops, routeStart, routeEnd, showConstellation]);

  const hasRoute = isRouteRequested && !!route.data;
  // 폰은 재생 줄을 출발·도착 밑으로 올린다 (`journey-top`, S15P21A405-714) — 바닥 줄은 넓은 화면에만 남긴다
  const narrow = useIsNarrow();

  return (
    <Box lead={<PanelBackButton />} title="여정" actions={<PanelCloseButton />} footer={narrow ? undefined : <JourneySummary route={route.data ?? null} />}>
      {!isRouteRequested && <JourneyEmptyPrompt />}
      {isRouteRequested && route.isPending && <JourneySkeleton />}
      {hasRoute && route.data && (
        <>
          <JourneyTop route={route.data} />
          <JourneyStopList route={route.data} />
        </>
      )}
    </Box>
  );
}
