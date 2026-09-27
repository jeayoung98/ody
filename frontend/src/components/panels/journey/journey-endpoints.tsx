"use client";

import { useRef } from "react";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useSheetPeek } from "@/hooks/use-sheet-peek";
import { useSheetStop } from "@/hooks/use-sheet-stop";
import { useJourneyStore } from "@/stores/use-journey-store";
import JourneyEndpointField from "./journey-endpoint-field";

/**
 * 여정 패널 상단의 출발·도착 표시 (JOURNEY-01).
 * 여기서는 바꿀 수 없다 — 곡 이름을 누르면 패널이 닫히고 상단 확장 검색창이 열린다.
 *
 * **폰 시트의 1·2 단이 이 상자 아래에서 멈춘다** (S15P21A405-714). 곡 상세·프로필과 같은 장치다 —
 * 1 단은 머리글을 접고 이 상자까지(`use-sheet-peek`), 2 단은 머리글과 이 상자까지(`use-sheet-stop`).
 * 예전에는 기본 높이라 1 단에 출발 줄 머리만, 2 단에 경로 목록 첫 줄이 반쯤 걸렸다. 경로 목록은 3 단에서 본다.
 * 넓은 화면에는 단이 없어서 두 값이 쓰이지 않는다 (`globals.css` 의 폰 전용 규칙).
 */
export default function JourneyEndpoints() {
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const openComposer = useOpenJourneyComposer();
  const boxRef = useRef<HTMLDivElement>(null);
  useSheetPeek(boxRef, "bottom");
  useSheetStop(boxRef);

  return (
    <div ref={boxRef} className="flex flex-col gap-0.5 rounded-box-sm bg-white/[.025] px-3 py-2">
      <JourneyEndpointField label="출발" tone="teal" musicId={startMusicId} onOpenComposer={() => openComposer("start")} />
      <JourneyEndpointField label="도착" tone="violet" musicId={endMusicId} onOpenComposer={() => openComposer("end")} />
    </div>
  );
}
