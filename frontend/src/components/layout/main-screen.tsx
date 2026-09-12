"use client";

import type { ReactNode } from "react";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import BottomBar from "@/components/player/bottom-bar";
import ConfirmDialog from "@/components/common/confirm-dialog";
import Toast from "@/components/common/toast";
import ReactionButton from "@/components/player/reaction-button";
import Brand from "./brand";
import HelpButton from "./help-button";
import Rail from "./rail";
import JourneyComposer from "./journey-composer";
import SearchBar from "./search-bar";
import SearchOpenButton from "./search-open-button";
import FollowBanner from "@/components/map/follow-banner";
import GhostBanner from "@/components/map/ghost-banner";
import OverlayClose from "@/components/map/overlay-close";
import MapView from "@/components/map/map-view";
import MinimapPanel from "@/components/minimap/minimap-panel";
import RightPanel from "@/components/panels/right-panel";

/** 우측 패널·레일이 가리는 폭(px). tokens.css 의 --spacing-right-panel / --spacing-rail 과 맞춘다 */
const RAIL_OCCLUSION = 76;
const PANEL_OCCLUSION = 376 + 74 + 16;

interface MainScreenProps {
  /** 지도 위에 얹을 오버레이 (튜토리얼 등) */
  overlay?: ReactNode;
}

/**
 * 기본 화면 = 풀스크린 별지도 위에 떠 있는 글래스 HUD.
 * 상단(브랜드·레이어 스테퍼 / 검색 / 도움말) · 우측(패널 + 레일) · 좌하단(계기판) · 하단(플레이어·주변 탐색) · 우하단(반응)
 */
export default function MainScreen({ overlay }: MainScreenProps) {
  const activePanel = usePanelStore((s) => s.activePanel);
  const composerOpen = useJourneyStore((s) => s.isComposerOpen);

  return (
    <div className="fixed inset-0 overflow-hidden bg-void text-ink">
      <MapView occludedRight={activePanel ? PANEL_OCCLUSION : RAIL_OCCLUSION} />
      <Brand />
      {/* 여정 만들기 중에는 검색바가 확장 패널로 바뀐다 (JOURNEY-01).
          검색창과 우측 패널은 동시에 뜨지 않는다 — 패널이 열려 있으면 검색은 작은 버튼으로 접힌다 */}
      {composerOpen ? <JourneyComposer /> : activePanel ? <SearchOpenButton /> : <SearchBar />}
      <HelpButton />
      <FollowBanner />
      <OverlayClose />
      <GhostBanner />
      <Rail />
      {activePanel && <RightPanel />}
      <MinimapPanel />
      <BottomBar />
      <ReactionButton />
      {overlay}
      <Toast />
      <ConfirmDialog />
    </div>
  );
}
