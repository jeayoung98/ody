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
  // 데스크톱 손잡이는 1(접힘)·3(펼침) 두 자리만 쓴다 (S15P21A405-416)
  const collapsed = usePanelStore((s) => s.snap) === 1;
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
       * **폰에서는 숨는다** (S15P21A405-417). 거기서 패널은 옆이 아니라 아래에서 올라오는
       * 시트라, 옆구리에 붙은 혀는 미는 방향과 어긋난다 — 시트는 제 위쪽 손잡이 막대로 접는다.
       */
      hitClassName="max-tablet:hidden"
    />
  );
}
