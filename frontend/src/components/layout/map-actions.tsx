"use client";

import { usePathname } from "next/navigation";
import { JourneyIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { usePanelEnabled } from "@/hooks/use-features";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import NearbyExploreButton from "./nearby-explore-button";
import RailButton from "./rail-button";

/**
 * 지도 탭에서만 나오는 **동작** 줄 (S15P21A405-417). 폰 전용 — 데스크톱은 우상단 레일이 맡는다.
 *
 * 주변 탐색과 여정은 목적지가 아니라 **지도를 바꾸는 동작**이다. 하단 탭에 같이 넣어 뒀더니
 * "랭킹을 보는 중인데 주변 탐색이 켜진" 상태가 생겼다 — 탭은 어디에 있는지를, 이 줄은
 * 그 자리에서 무엇을 하는지를 말한다.
 *
 * 그래서 **지도 탭일 때만** 그린다. 다른 탭에서는 지도가 밑에 살아 있어도 이 줄은 없다.
 * 재생바 바로 위에 붙어, 아래 상자와 한 기둥으로 읽힌다.
 */
export default function MapActions() {
  const pathname = usePathname();
  const panelEnabled = usePanelEnabled();
  const toggle = usePanelStore((s) => s.toggle);
  const hasJourney = useJourneyStore((s) => s.isRouteRequested);
  const composerOpen = useJourneyStore((s) => s.isComposerOpen);
  const closeComposer = useJourneyStore((s) => s.closeComposer);
  const openComposer = useOpenJourneyComposer();
  const activePanel = usePanelStore((s) => s.activePanel);
  const collapsed = usePanelStore((s) => s.collapsed);
  const sheetUp = activePanel != null && !collapsed;

  if (pathname !== ROUTES.home) return null;
  /**
   * 시트가 올라와 있으면 숨는다 (S15P21A405-417). 이 줄은 z-22 라 시트(z-20) 위에 뜨는데,
   * 시트가 화면을 채운 동안에는 지도를 바꿀 일이 없다 — 떠 있어 봐야 내용만 가린다.
   * 접어서 지도가 드러나면 다시 나온다.
   */
  if (sheetUp) return null;

  /** 레일의 여정 버튼과 같은 규칙이다 (S15P21A405-434) — 상자가 떠 있으면 상자를, 아니면 패널을 */
  const pressJourney = () => {
    if (composerOpen) closeComposer();
    else if (hasJourney) toggle("journey");
    else openComposer("start");
  };

  return (
    <div
      data-hud
      className="glass-liquid absolute right-gutter-sm bottom-[calc(var(--nav-bottom)+4px)] z-[22] hidden gap-0.5 rounded-pill! p-px max-tablet:flex"
    >
      <NearbyExploreButton />
      {panelEnabled.journey && (
        <RailButton label="여정" active={composerOpen} onClick={pressJourney} data-tutorial="journey">
          <JourneyIcon size={16} />
        </RailButton>
      )}
    </div>
  );
}
