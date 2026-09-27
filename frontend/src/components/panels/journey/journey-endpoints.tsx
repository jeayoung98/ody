"use client";

import { useRef } from "react";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useSheetPeek } from "@/hooks/use-sheet-peek";
import { useJourneyStore } from "@/stores/use-journey-store";
import JourneyEndpointField from "./journey-endpoint-field";

/**
 * 여정 패널 상단의 출발·도착 표시 (JOURNEY-01).
 * 여기서는 바꿀 수 없다 — 곡 이름을 누르면 패널이 닫히고 상단 확장 검색창이 열린다.
 *
 * **폰 시트 1 단이 이 상자 아래에서 멈춘다** (S15P21A405-714). 곡 상세·프로필과 같은 장치다 —
 * 머리글을 접고 이 상자까지만 걸린다(`use-sheet-peek`). 예전에는 기본 높이라 출발 줄 머리만 걸렸다.
 * 2 단은 그 아래 재생 줄까지다 (`journey-top`). 넓은 화면에는 단이 없어 이 값이 쓰이지 않는다.
 */
export default function JourneyEndpoints() {
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const openComposer = useOpenJourneyComposer();
  const boxRef = useRef<HTMLDivElement>(null);
  useSheetPeek(boxRef, "bottom");

  return (
    <div ref={boxRef} className="flex flex-col gap-0.5 rounded-box-sm bg-white/[.025] px-3 py-2">
      <JourneyEndpointField label="출발" tone="teal" musicId={startMusicId} onOpenComposer={() => openComposer("start")} />
      <JourneyEndpointField label="도착" tone="violet" musicId={endMusicId} onOpenComposer={() => openComposer("end")} />
    </div>
  );
}
