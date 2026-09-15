"use client";

import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 우측 패널 접기·펼치기 핸들 (S15P21A405-318).
 *
 * 좌하단 계기판의 핸들과 **거울대칭**이다 (`minimap-panel.tsx`, S15P21A405-287).
 * 패널의 자식이라 접혀도 같은 요소로 남고 자리만 따라간다 — 접힌 상태에서도 모양이 바뀌지 않는다.
 *
 * **접기는 닫기가 아니다.** 별자리 뷰도 열린 패널 종류도 그대로 두고 자리만 비켜 준다.
 * 닫기(✕)는 별자리까지 같이 끈다 (S15P21A405-316).
 */
export default function PanelCollapseHandle() {
  const collapsed = usePanelStore((s) => s.collapsed);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);

  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-expanded={!collapsed}
      title={collapsed ? "패널 펼치기" : "패널 접기"}
      className="glass absolute top-1/2 -left-[22px] z-10 flex h-[68px] w-[22px] -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-l-box-xs! rounded-r-none! border-r-0! text-ink-3 transition-colors hover:text-ink"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* 펼쳐져 있으면 → (밀어 넣기), 접혀 있으면 ← (끌어 내기) */}
        <path d={collapsed ? "M6.5 1.5 3 5l3.5 3.5" : "M3.5 1.5 7 5 3.5 8.5"} />
      </svg>
    </button>
  );
}
