"use client";

import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";

/** 아직 여정이 없을 때. 누르면 상단 확장 검색창이 열린다 (JOURNEY-01) */
export default function JourneyEmptyPrompt() {
  const openComposer = useOpenJourneyComposer();

  return (
    <button
      type="button"
      onClick={() => openComposer()}
      className="flex w-full flex-col items-center gap-2 rounded-box border border-dashed border-line px-4 py-8 text-center transition-colors duration-fast hover:border-teal/50 hover:bg-white/[.03]"
    >
      <span className="grad-text font-display text-[17px] font-semibold">두 곡 사이를 여행해보세요</span>
      <span className="text-xs leading-relaxed text-ink-3">
        출발과 도착을 정하면 그 사이의 곡들이
        <br />
        지도 위에 별자리처럼 이어집니다.
      </span>
      <span className="lbl mt-1 rounded-pill border border-line px-2.5 py-1 text-ink-2">여정 만들기</span>
    </button>
  );
}
