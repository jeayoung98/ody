"use client";

import { usePathname } from "next/navigation";
import { JourneyIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { RIDING_JOURNEY_BLOCKED } from "@/constants";
import { usePanelEnabled } from "@/hooks/use-features";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useFollowStore } from "@/stores/use-follow-store";
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
  const riding = useFollowStore((s) => s.leaderEmail != null);

  if (pathname !== ROUTES.home) return null;

  /** 레일의 여정 버튼과 같은 규칙이다 (S15P21A405-434) — 상자가 떠 있으면 상자를, 아니면 패널을 */
  const pressJourney = () => {
    if (composerOpen) closeComposer();
    else if (hasJourney) toggle("journey");
    else openComposer();
  };

  return (
    <div
      data-hud
      /*
        **윗줄, 도움말 왼쪽에 붙는다** (S15P21A405-593). 예전에는 재생바 위 오른쪽 아래에
        있었는데, 거기가 곧 시트가 걸쳐 있는 자리라 **시트가 뜨면 통째로 숨겨야 했다** —
        시트는 거의 항상 열려 있으므로 사실상 안 보이는 버튼이었다.
        윗줄은 시트(`--spacing-hud-t` + 40 아래에서 시작)가 닿지 않는 자리라 숨길 이유가 없다.

        **오른쪽 끝에 붙고, 알약 없이 흰 아이콘만 뜬다** (S15P21A405-703). 도움말을 폰에서 숨기면서
        그 자리(68px)를 비켜 설 이유가 없어졌다. 높이는 로고·검색과 같은 32px 라 윗줄 가운데선이 맞는다.
      */
      // 검색을 펴면 감춘다 (`data-map-actions`, `globals.css`) — 검색창이 이 자리까지 늘어난다 (S15P21A405-703)
      data-map-actions
      className="absolute top-hud-t right-gutter-sm z-[22] hidden h-8 items-center gap-3 transition-opacity duration-300 max-tablet:flex"
    >
      <NearbyExploreButton bare />
      {panelEnabled.journey && (
        /* 레일과 같은 규칙으로 잠근다 (S15P21A405-660) — 여기만 열려 있으면 폰에서만 뚫린다 */
        <RailButton
          label="여정"
          active={composerOpen}
          disabled={riding}
          title={riding ? RIDING_JOURNEY_BLOCKED : "여정"}
          onClick={pressJourney}
          data-tutorial="journey"
          bare
        >
          <JourneyIcon size={17} />
        </RailButton>
      )}
      {/*
        **폰에는 이벤트 입구를 두지 않는다** (S15P21A405-617). S15P21A405-602 에서 여기에 넣었던
        것을 기획 판단으로 걷었다. 데스크톱은 우상단 원형 버튼(`contest-button`)이 그대로 맡는다 —
        모달이라 패널 상태와 무관하고, 이 줄에서 빠져도 그쪽은 영향이 없다.
      */}
    </div>
  );
}
