"use client";

import { useMemo, type ReactNode } from "react";
import { HUD_OCCLUSION } from "@/constants";
import type { Occlusion } from "@/components/map/engine/map-engine";
import { useFeatures, usePanelEnabled } from "@/hooks/use-features";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import BottomBar from "@/components/player/bottom-bar";
import ConfirmDialog from "@/components/common/confirm-dialog";
import Toast from "@/components/common/toast";
import Brand from "./brand";
import Rail from "./rail";
import JourneyComposer from "./journey-composer";
import SearchBar from "./search-bar";
import FollowBanner from "@/components/map/follow-banner";
import GhostBanner from "@/components/map/ghost-banner";
import MapAxisLabels from "@/components/map/map-axis-labels";
import MapView from "@/components/map/map-view";
import MinimapPanel from "@/components/minimap/minimap-panel";
import RightPanel from "@/components/panels/right-panel";
import { HANDLE_W } from "@/components/common/collapse-handle";
import { RIGHT_PANEL_W } from "@/constants/design-tokens";
import PlayHint from "@/components/discovery/play-hint";
import SurveyGate from "@/components/survey/survey-gate"; // REMOVE-WITH-SURVEY

/**
 * 우측 패널이 가리는 폭(px). 지도 엔진이 **별·고리·카메라를 패널 밖에 두는** 기준이라,
 * 패널의 실제 기하와 어긋나면 그만큼 지도가 손해를 본다.
 *
 * **숫자를 직접 적지 않고 패널 기하에서 끌어온다** (S15P21A405-479). 477 에서 핸들이 22→17 로
 * 줄고 미는 식이 `376` 고정에서 `calc(100% - 10px)` 로 바뀌었는데 여기 상수만 예전 값(64)으로
 * 남아, 접었을 때 엔진이 19px 을 과하게 비우고 있었다. 세 군데에 같은 숫자를 손으로 적어 두면
 * 또 어긋난다.
 *
 * 접힘: 화면에 남는 몸통(여백 18 + 덜 민 10 = 28) + 핸들(17) = 45.
 *   `right-panel.tsx` 의 `translate-x-[calc(100%_-_10px)]` 와 `collapse-handle.tsx` 의 `W` 에서 온다.
 * 펼침: 패널폭 + 여백(18) + 틈(16).
 */
const PANEL_EDGE = 18;
/** 접었을 때 화면 끝에 일부러 남기는 몸통 — `right-panel.tsx` 의 `calc(100% - 10px)` 의 10 */
const PEEK_BODY = 10;
const PEEK_OCCLUSION = PANEL_EDGE + PEEK_BODY + HANDLE_W;
const PANEL_OCCLUSION = RIGHT_PANEL_W + PANEL_EDGE + 16;

interface MainScreenProps {
  /** 지도 위에 얹을 오버레이 (튜토리얼 등) */
  overlay?: ReactNode;
}

/**
 * 기본 화면 = 풀스크린 별지도 위에 떠 있는 글래스 HUD.
 * 상단(브랜드·레이어 스테퍼 / 검색 / 네비·프사) · 우측(패널) · 좌하단(계기판·도움말) · 우하단(플레이어)
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
  /**
   * 지도가 가려지는 네 변 (S15P21A405-414). 지금 움직이는 것은 우측 패널 하나이고, 위아래는
   * 늘 덮여 있는 HUD 두께다. 바텀시트가 들어오면 아래가 여기서 움직인다 (S15P21A405-416).
   *
   * **매 렌더 새 객체를 만들면 안 된다** — 받는 쪽 effect 의 의존성이라 값이 같아도 매번 다시 돈다.
   */
  const occlusion = useMemo<Occlusion>(
    () => ({ top: HUD_OCCLUSION.top, right: occludedRight, bottom: HUD_OCCLUSION.bottom, left: 0 }),
    [occludedRight],
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-void text-ink">
      <MapView occlusion={occlusion} />
      {/* 축 라벨은 지도 바로 위, 나머지 HUD 아래다 — 배경처럼 깔려야 한다 */}
      <MapAxisLabels occlusion={occlusion} />
      <Brand />
      {/* 여정 만들기 중에는 검색바가 확장 패널로 바뀐다 (JOURNEY-01).
          검색창은 스스로 접혔다 펴진다 — 펴질 때 우측 패널을 닫는다 (S15P21A405-440) */}
      {composerOpen ? <JourneyComposer /> : <SearchBar />}
      {features.social && <FollowBanner />}
      <GhostBanner />
      <Rail />
      {panelOpen && <RightPanel />}
      <MinimapPanel />
      <BottomBar />
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
