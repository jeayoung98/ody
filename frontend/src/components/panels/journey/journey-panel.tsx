"use client";

import { useEffect } from "react";
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
 * 경로가 도착하면 **곧바로 별자리 뷰가 켜진다.** 이후에는 좌상단 `별자리 뷰` 택으로 껐다 켠다 (PATH-01).
 */
export default function JourneyPanel() {
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const isRouteRequested = useJourneyStore((s) => s.isRouteRequested);
  const route = useJourneyRouteQuery(startMusicId, endMusicId, isRouteRequested);
  const showConstellation = useMapStore((s) => s.showConstellation);

  const stops = route.data?.stops;
  useEffect(() => {
    if (stops && stops.length >= 2) showConstellation(stops.map((s) => s.id));
  }, [stops, showConstellation]);

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
