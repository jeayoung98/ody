"use client";

import CollapseHandle from "@/components/common/collapse-handle";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 우측 패널 접기·펼치기 핸들 (S15P21A405-318).
 *
 * 좌하단 계기판의 핸들과 **같은 물건**이다 (`common/collapse-handle`) — 거울처럼 방향만 뒤집는다.
 * 패널의 자식이라 접혀도 같은 요소로 남고 자리만 따라간다.
 *
 * **접기는 닫기가 아니다.** 별자리 뷰도 열린 패널 종류도 그대로 두고 자리만 비켜 준다.
 * 닫기(✕)는 별자리까지 같이 끈다 (S15P21A405-316).
 */
export default function PanelCollapseHandle() {
  const collapsed = usePanelStore((s) => s.collapsed);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);

  return (
    <CollapseHandle
      side="left"
      // 펼쳐져 있으면 → (밀어 넣기), 접혀 있으면 ← (끌어 내기)
      pointing={collapsed ? "left" : "right"}
      expanded={!collapsed}
      onClick={toggleCollapsed}
      title={collapsed ? "패널 펼치기" : "패널 접기"}
    />
  );
}
