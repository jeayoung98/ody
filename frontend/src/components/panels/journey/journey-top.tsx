"use client";

import { useRef } from "react";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { useSheetStop } from "@/hooks/use-sheet-stop";
import type { JourneyRoute } from "@/types";
import JourneyEndpoints from "./journey-endpoints";
import JourneySummary from "./journey-summary";

/**
 * 여정 패널 윗부분 — 출발·도착, 그리고 **폰에서는 그 바로 아래 재생 줄** (S15P21A405-714, 사용자 결정).
 *
 * 폰 시트는 2 단으로 열리는데, 재생 줄(총 재생 · 경로 지우기 · 순차 재생)이 바닥에 붙어 있으면 3 단까지
 * 올려야 보였다. 경로를 받자마자 하는 일이 "틀기" 라 출발·도착 밑으로 올리고, **2 단이 이 묶음 아래에서
 * 멈춘다** (`use-sheet-stop`). 1 단은 출발·도착까지다 (`journey-endpoints` 의 `use-sheet-peek`).
 *
 * 넓은 화면은 그대로다 — 재생 줄은 패널 바닥(`Box` 의 footer)에 남고 이 묶음은 출발·도착만 감싼다.
 */
export default function JourneyTop({ route }: { route: JourneyRoute }) {
  const narrow = useIsNarrow();
  const topRef = useRef<HTMLDivElement>(null);
  useSheetStop(topRef);

  return (
    <div ref={topRef} className="flex flex-col gap-3">
      <JourneyEndpoints />
      {narrow && <JourneySummary route={route} />}
    </div>
  );
}
