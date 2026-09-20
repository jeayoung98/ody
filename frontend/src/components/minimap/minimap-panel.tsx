"use client";

import { useState } from "react";
import CollapseHandle from "@/components/common/collapse-handle";
import HelpButton from "@/components/layout/help-button";
import AxisCompass from "./axis-compass";
import LayerGauge from "./layer-gauge";
import LayerName from "./layer-name";
import MinimapCanvas from "./minimap-canvas";

/**
 * #instr — 좌하단 계기판: 미니맵 · 깊이 게이지 · 레이어 이름 · 축 나침반.
 * 지도를 넓게 보고 싶을 때가 있어서 접을 수 있다.
 *
 * 접기·펼치기는 패널 **오른쪽 가장자리에 튀어나온 핸들** 하나다 (S15P21A405-287). 접으면 패널이 왼쪽으로
 * 미끄러져 나가고 핸들만 화면 왼쪽 끝에 남는다 — 핸들이 패널의 자식이라 두 상태에서 같은 요소고,
 * 모양이 바뀌지 않고 자리만 따라간다. 예전엔 패널 안 작은 ▼ 와 별도의 필 버튼이라 눈에 안 띄고 모양이 달랐다.
 *
 * **유리는 바깥 `<aside>` 가 아니라 안쪽 `<div>` 가 쓴다** (S15P21A405-477). `backdrop-filter` 가
 * 걸린 요소는 backdrop root 가 되어, 그 **자식의** `backdrop-filter` 는 페이지 뒤가 아니라 그 root
 * 안쪽만 보게 된다. 유리를 aside 에 두면 밖으로 튀어나온 손잡이·도움말이 그 안에 갇혀 블러가
 * 아예 먹지 않았다 — 도움말이 검색창·네비바와 달라 보인 원인이다. 우측 패널(`right-panel`)은
 * 처음부터 이 구조였다: 바깥은 자리만 잡고 유리는 안쪽에 있다.
 */
export default function MinimapPanel() {
  /**
   * **접은 채로 시작한다** (S15P21A405-350 · 358). 별지도가 어떤 곳인지부터 넓게 보여 주는
   * 게 낫다 — 계기판은 지금 어디쯤인지 궁금해진 다음에 필요해진다. 축이 어느 쪽인지는
   * 지도 가장자리가 늘 적어 두고 있어서(`map-axis-labels`) 펴지 않아도 아쉽지 않다.
   * 첫 값일 뿐이라 언제든 핸들로 편다.
   */
  const [open, setOpen] = useState(false);

  return (
    <aside
      data-hud
      /*
       * 좁은 화면에서는 바닥을 떠나 세로 가운데로 간다 (S15P21A405-417). 375px 에서 재 보면
       * 재생바가 y633~794 로 161px 을 쓰는데 계기판도 `bottom-hud-b` 라 같은 바닥에 붙어,
       * 접힌 몸통 10px 과 **밖으로 튀어나온 도움말 버튼이 재생바 위에 얹혔다** (44×44 겹침).
       * 가운데로 보내면 위로는 레일(~y60), 아래로는 재생바(y633~) 사이에 그대로 들어간다.
       * 도움말은 이 `<aside>` 의 자식이라 따라온다.
       */
      className={`absolute bottom-hud-b left-[18px] z-20 w-instrument transition-transform duration-300 ease-out max-tablet:top-1/2 max-tablet:bottom-auto max-tablet:left-gutter-sm ${open ? "max-tablet:-translate-y-1/2" : "translate-x-[calc(-100%_+_10px)] max-tablet:translate-x-[calc(-100%_-_var(--spacing-gutter-sm))] max-tablet:-translate-y-1/2"}`}
    >
      <CollapseHandle
        side="right"
        pointing={open ? "left" : "right"}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={open ? "계기판 접기" : "계기판 펼치기"}
      />
      {/* 도움말 — 계기판 오른쪽에 붙어 같이 접힌다 (S15P21A405-434) */}
      <HelpButton />
      {/* 유리는 여기. 손잡이·도움말은 이 밖에 있어야 제 블러가 산다 */}
      <div className="glass-liquid flex flex-col gap-[11px] px-3.5 pt-[13px] pb-3.5">
        <MinimapCanvas />
        <LayerGauge />
        <LayerName />
        <AxisCompass />
      </div>
    </aside>
  );
}
