"use client";

import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import JourneyEndpointField from "./journey-endpoint-field";

/**
 * 여정 패널 상단의 출발·도착 표시 (JOURNEY-01).
 * 여기서는 바꿀 수 없다 — 곡 이름을 누르면 패널이 닫히고 상단 확장 검색창이 열린다.
 *
 * 폰 시트의 1·2 단은 이 상자가 아니라 그 밑 재생 줄까지 감싼 묶음에서 멈춘다 (`journey-top`, S15P21A405-714).
 */
export default function JourneyEndpoints() {
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  const openComposer = useOpenJourneyComposer();

  return (
    <div className="flex flex-col gap-0.5 rounded-box-sm bg-white/[.025] px-3 py-2">
      <JourneyEndpointField label="출발" tone="teal" musicId={startMusicId} onOpenComposer={() => openComposer("start")} />
      <JourneyEndpointField label="도착" tone="violet" musicId={endMusicId} onOpenComposer={() => openComposer("end")} />
    </div>
  );
}
