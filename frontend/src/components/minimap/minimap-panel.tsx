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
      className={`glass-liquid absolute bottom-[18px] left-[18px] z-20 flex w-instrument flex-col gap-[11px] px-3.5 pt-[13px] pb-3.5 transition-transform duration-300 ease-out ${open ? "" : "translate-x-[calc(-100%_+_10px)]"}`}
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
      <MinimapCanvas />
      <LayerGauge />
      <LayerName />
      <AxisCompass />
    </aside>
  );
}
