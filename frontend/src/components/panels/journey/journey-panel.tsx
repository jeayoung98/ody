"use client";

import { useEffect, useMemo } from "react";
import Box from "@/components/common/box";
import Loading from "@/components/common/loading";
import { useJourneyRouteQuery } from "@/hooks/queries/use-journey-route-query";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import PanelCloseButton from "../panel-close-button";
import JourneyEmptyPrompt from "./journey-empty-prompt";
import JourneyEndpoints from "./journey-endpoints";
import JourneyStopList from "./journey-stop-list";
import JourneySummary from "./journey-summary";

/**
 * 여정 패널 (JOURNEY-01, PATH-01/02) — **결과를 보여주는 화면**이다.
 * 지점을 고치거나 경로를 만드는 일은 상단 확장 검색창에서만 한다.
 * 경로가 생기면 재생하지 않아도 지도에 별자리로 미리 뜬다 (다른 별자리를 재생 중이면 그쪽은 흐려진다).
 */
export default function JourneyPanel() {
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const isRouteRequested = useJourneyStore((s) => s.isRouteRequested);
  const route = useJourneyRouteQuery(startMusicId, endMusicId, isRouteRequested);
  const previewConstellation = useMapStore((s) => s.previewConstellation);

  const stopIds = useMemo(() => route.data?.stops.map((s) => s.id) ?? [], [route.data]);
  useEffect(() => {
    if (isRouteRequested && stopIds.length >= 2) previewConstellation(stopIds);
  }, [isRouteRequested, stopIds, previewConstellation]);

  const hasRoute = isRouteRequested && !!route.data;

  return (
    <Box title="여정" code="JOURNEY-01 · PATH-01" actions={<PanelCloseButton />} footer={<JourneySummary route={route.data ?? null} />}>
      {!isRouteRequested && <JourneyEmptyPrompt />}
      {isRouteRequested && route.isPending && <Loading label="경로를 만드는 중" />}
      {hasRoute && (
        <>
          <JourneyEndpoints />
          <JourneyStopList route={route.data ?? null} />
        </>
      )}
    </Box>
  );
}
