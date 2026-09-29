"use client";

import HelpButton from "@/components/layout/help-button";
import { useContestStore } from "@/stores/use-contest-store";
import AxisCompass from "./axis-compass";
import LayerGauge from "./layer-gauge";
import LayerName from "./layer-name";
import MinimapCanvas from "./minimap-canvas";

/**
 * #instr — 좌하단 계기판: 깊이 게이지 · 레이어 이름 · 그 아래 미니맵 위에 겹친 축 나침반.
 *
 * **유리 상자도 접기 손잡이도 없다** (S15P21A405-722, 사용자 결정). 예전에는 유리 패널 안에 넷을 넣고
 * 오른쪽 손잡이로 접었는데(S15P21A405-287 · 350), 접은 채로 시작해서 계기판이 있는 줄 모르는 사람이 많았다.
 * 지금은 지도 위에 글자·미니맵이 바로 떠 있고 **항상 보인다.** 배경 유리가 없어 지도를 가리는 면적도 줄었다.
 * 나침반 별과 축 라벨은 미니맵 위에 연하게 겹친다 — 방향 설명이 지도 축소판 안에서 바로 읽힌다.
 *
 * 이벤트 모달이 떠 있는 동안만 왼쪽으로 밀려 나간다 (S15P21A405-665) — 우측 패널과 같은 규칙.
 */
export default function MinimapPanel() {
  const contestOpen = useContestStore((s) => s.open);

  return (
    <aside
      data-hud
      /*
       * **좁은 화면에서는 계기판을 걷어낸다** (S15P21A405-417). 폰에서 대신할 곳이 있다 — 겹 이름·깊이는
       * 좌상단 브랜드 아래가, 축은 겹 전환 자막과 곡 상세가 적는다.
       *
       * **도움말은 살린다.** 이 `<aside>` 의 자식이라 같이 사라지므로, 몸통(`data-body`)만 감추고 껍데기는
       * 남겨 우상단으로 보낸다 — 레일이 아래로 내려가 비어 있는 자리다. 도움말이 `-right-[52px] bottom-0` 으로
       * 이 상자에 매달려 있어서, 폭 0 · 높이 44 로 두면 오른쪽 끝이 여백선(16px)에 맞고 윗줄 높이와도 나란해진다.
       */
      className={`absolute bottom-hud-b left-[18px] z-20 w-instrument transition-transform duration-300 ease-out max-tablet:top-hud-t max-tablet:right-[68px] max-tablet:bottom-auto max-tablet:left-auto max-tablet:h-touch max-tablet:w-0 max-tablet:translate-x-0 max-tablet:[&>div[data-body]]:hidden ${
        contestOpen ? "translate-x-[calc(-100%_-_18px)]" : ""
      }`}
    >
      {/* 도움말 — 계기판 오른쪽에 붙는다 (S15P21A405-434) */}
      <HelpButton />
      {/* 유리 없이 지도 위에 바로 선다 — 글자는 그림자로 바탕을 눌러 별 위에서도 읽힌다 */}
      <div data-body className="flex flex-col gap-[11px] [text-shadow:0_1px_3px_rgba(2,4,10,.9)]">
        <LayerGauge />
        <LayerName />
        {/* 미니맵 + 그 위에 겹친 나침반. 나침반은 클릭을 받지 않아 미니맵 클릭 이동이 그대로 된다 */}
        <div className="relative">
          <MinimapCanvas />
          <AxisCompass />
        </div>
      </div>
    </aside>
  );
}
