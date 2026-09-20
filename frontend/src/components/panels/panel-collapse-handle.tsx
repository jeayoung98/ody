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
      /*
       * 폰에서는 **손가락이 닿는 넓이만** 넓힌다 (S15P21A405-417). 17px 짜리 혀는 마우스로는
       * 충분해도 손가락으로는 못 누른다 (`--spacing-touch` 44px). 모양은 그대로 두고 투명한
       * 판을 깔아 위아래 8px · 좌우 14px 을 더한다 — 왼쪽은 화면 여백(16px)으로, 오른쪽은
       * 패널 제 안쪽 여백으로 나가므로 가리는 것이 없다.
       */
      hitClassName="max-tablet:after:absolute max-tablet:after:-inset-y-2 max-tablet:after:-inset-x-[14px] max-tablet:after:content-['']"
    />
  );
}
