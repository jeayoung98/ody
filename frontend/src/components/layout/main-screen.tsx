"use client";

import type { ReactNode } from "react";
import { useFeatures, usePanelEnabled } from "@/hooks/use-features";
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
import MapAxisLabels from "@/components/map/map-axis-labels";
import MapView from "@/components/map/map-view";
import MinimapPanel from "@/components/minimap/minimap-panel";
import RightPanel from "@/components/panels/right-panel";
import PlayHint from "@/components/discovery/play-hint";
import SurveyGate from "@/components/survey/survey-gate"; // REMOVE-WITH-SURVEY

/**
 * 우측 패널이 가리는 폭(px). `right-panel.tsx` 의 자리와 맞춘다 (S15P21A405-427).
 * 접힘: 화면 여백(18) + 남긴 몸통(18) + 핸들(22) + 틈(6) = 64.
 * 펼침: 패널폭(376, tokens.css 의 --spacing-right-panel) + 여백(18) + 틈(16) = 410.
 */
const PEEK_OCCLUSION = 18 + 18 + 22 + 6;
const PANEL_OCCLUSION = 376 + 18 + 16;

interface MainScreenProps {
  /** 지도 위에 얹을 오버레이 (튜토리얼 등) */
  overlay?: ReactNode;
}

/**
 * 기본 화면 = 풀스크린 별지도 위에 떠 있는 글래스 HUD.
 * 상단(브랜드·레이어 스테퍼 / 검색 / 네비·도움말) · 우측(패널) · 좌하단(계기판) · 우하단(플레이어, 그 위 반응)
 */
export default function MainScreen({ overlay }: MainScreenProps) {
  const activePanel = usePanelStore((s) => s.activePanel);
  const panelCollapsed = usePanelStore((s) => s.collapsed);
  const composerOpen = useJourneyStore((s) => s.isComposerOpen);
  /**
   * 감춘 기능의 패널은 열려 있어도 화면에 없다 (S15P21A405-333). 여기서도 같은 판정을 써야
   * **안 보이는 패널 몫으로 지도가 좁아지는** 일이 없다.
   */
  const features = useFeatures();
  const panelEnabled = usePanelEnabled();
  const panelOpen = activePanel != null && panelEnabled[activePanel];
  // 접힌 패널은 화면 밖으로 나가 있으므로 가리지 않는다 — 별자리가 그만큼 넓게 퍼진다 (S15P21A405-318)
  const occludedRight = panelOpen && !panelCollapsed ? PANEL_OCCLUSION : PEEK_OCCLUSION;

  return (
    <div className="fixed inset-0 overflow-hidden bg-void text-ink">
      <MapView occludedRight={occludedRight} />
      {/* 축 라벨은 지도 바로 위, 나머지 HUD 아래다 — 배경처럼 깔려야 한다 */}
      <MapAxisLabels occludedRight={occludedRight} />
      <Brand />
      {/* 여정 만들기 중에는 검색바가 확장 패널로 바뀐다 (JOURNEY-01).
          검색창과 우측 패널은 동시에 뜨지 않는다 — 패널이 열려 있으면 검색은 작은 버튼으로 접힌다 */}
      {composerOpen ? <JourneyComposer /> : panelOpen ? <SearchOpenButton /> : <SearchBar />}
      <HelpButton />
      {features.social && <FollowBanner />}
      <GhostBanner />
      <Rail />
      {panelOpen && <RightPanel />}
      <MinimapPanel />
      <BottomBar />
      {features.social && <ReactionButton />}
      {overlay}
      {/* 바로재생을 모르는 사람에게 문맥마다 한 번 짚어 준다 (S15P21A405-393). 조작은 막지 않는다 */}
      <PlayHint />
      <Toast />
      <ConfirmDialog />
      {/* 설문 — NEXT_PUBLIC_TEST_TOOLS(빌드) + ody:survey-mode(브라우저) 로 켠다. 걷어내는 법은 survey-gate.tsx */}{/* REMOVE-WITH-SURVEY */}
      <SurveyGate />{/* REMOVE-WITH-SURVEY */}
    </div>
  );
}
