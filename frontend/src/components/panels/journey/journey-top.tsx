"use client";

import { useRef } from "react";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { useSheetPeek } from "@/hooks/use-sheet-peek";
import { useSheetStop } from "@/hooks/use-sheet-stop";
import type { JourneyRoute } from "@/types";
import JourneyEndpoints from "./journey-endpoints";
import JourneySummary from "./journey-summary";

/**
 * 여정 패널 윗부분 — 출발·도착, 그리고 **폰에서는 그 바로 아래 재생 줄** (S15P21A405-714, 사용자 결정).
 *
 * 경로를 받자마자 하는 일이 "틀기" 라, 재생 줄(총 재생 · 경로 지우기 · 순차 재생)을 바닥이 아니라 출발·도착 밑에 둔다.
 * 폰 시트의 단은 이 묶음이 정한다 (사용자: "여정 1단에서 헤더만 없애고 총재생·경로 지우기·순차재생까지 살려놔").
 *
 * | 단 | 보이는 것 |
 * | --- | --- |
 * | 1 | 출발·도착 + 재생 줄 — 머리글은 접는다 (`use-sheet-peek`) |
 * | 2 | 머리글 + 출발·도착 + 재생 줄 — 경로 목록은 안 보인다 (`use-sheet-stop`) |
 * | 3 | 경로 목록까지 |
 *
 * 넓은 화면은 그대로다 — 재생 줄은 패널 바닥(`Box` 의 footer)에 남고 이 묶음은 출발·도착만 감싼다.
 */
export default function JourneyTop({ route }: { route: JourneyRoute }) {
  const narrow = useIsNarrow();
  const topRef = useRef<HTMLDivElement>(null);
  useSheetPeek(topRef, "bottom");
  useSheetStop(topRef);

  return (
    <div ref={topRef} className="flex flex-col gap-3">
      <JourneyEndpoints />
      {narrow && <JourneySummary route={route} />}
    </div>
  );
}
