"use client";

import { CoronaIcon } from "@/components/common/icons";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { useFollowStore } from "@/stores/use-follow-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import RailButton from "./rail-button";

/**
 * 주변 탐색 모드 토글. 켜지면 줌인되며 기준 곡 주변의 모든 곡(대표곡 아니어도)을 보여준다.
 * 기준 곡: 선택된 곡 > 재생 중인 곡. 둘 다 없으면 비활성.
 *
 * 하단 플레이어바 옆에 있던 것을 우상단 네비의 여정 옆으로 옮겼다 (S15P21A405-427) —
 * 둘 다 지도 뷰를 바꾸는 동작이라 한 알약에 있어야 짝으로 읽힌다.
 *
 * 켜기/닫기 **토글만** 한다. 주변 탐색 중 다른 이웃으로 건너가는 것(항해)은 선택한 별 곁에 붙는
 * "주변 보기 ›" 링크가 맡는다 (S15P21A405-288) — 한 버튼이 두 뜻을 갖지 않게
 */
export default function NearbyExploreButton() {
  const viewMode = useMapStore((s) => s.viewMode);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const exitNearby = useMapStore((s) => s.exitNearby);

  /**
   * 주변 탐색을 켜면 **상관없는 패널은 내려간다** (S15P21A405-417).
   *
   * 반대 방향은 이미 막혀 있었다 — `use-panel-store` 의 `syncMapView` 가 곡 상세가 아닌 패널을
   * 열 때 고리를 끈다. 이쪽만 빠져 있어서 **랭킹을 켜 둔 채 주변 탐색을 누르면 둘 다 떴고**,
   * 폰에서는 패널이 화면을 덮으니 고리가 그 아래 깔려 보이지도 않았다.
   *
   * 곡 상세는 예외다 — 고리는 그 곡에 딸린 화면이라 같이 떠 있는 게 맞다.
   *
   * **여정 만들기 상자도 같이 내린다.** 그건 패널이 아니라 상단 검색줄 자리에 뜨는 별개
   * 화면이라 `activePanel` 이 null 이다 — 그래서 경로를 짜다가 주변 탐색을 누르면 둘 다 떴다.
   */
  const activePanel = usePanelStore((s) => s.activePanel);
  const closePanel = usePanelStore((s) => s.close);
  const composerOpen = useJourneyStore((s) => s.isComposerOpen);
  const closeComposer = useJourneyStore((s) => s.closeComposer);

  /**
   * **따라가는 중에는 잠긴다** (S15P21A405-605, SOCIAL-08). 557 에서는 인솔자 곡을 중심으로
   * 열어 뒀는데, 기획이 따라가는 동안 지도 조작을 전부 막기로 했다 — 주변 탐색도 카메라를
   * 옮기는 지도 조작이다. 왜 안 눌리는지는 툴팁이 말한다.
   */
  const riding = useFollowStore((s) => s.leaderEmail != null);
  const target = selectedMusicId ?? currentMusicId;
  const active = viewMode === "nearby";
  const disabled = riding || (!active && target == null);

  const handleClick = () => {
    if (active) exitNearby();
    else if (target != null) {
      if (activePanel != null && activePanel !== "song") closePanel();
      if (composerOpen) closeComposer();
      enterNearby(target);
      useTutorialStore.getState().complete("nearby");
    }
  };

  return (
    <RailButton
      label="주변 탐색"
      active={active}
      disabled={disabled}
      // 상단에 올라온 뒤로 "왜 안 눌리지" 가 더 눈에 띈다 — 이유를 바로 말한다
      title={riding ? "따라가는 중에는 지도를 움직일 수 없어요" : disabled ? "곡을 먼저 고르세요" : active ? "주변 탐색 닫기" : "주변 탐색"}
      onClick={handleClick}
      data-tutorial="nearby"
    >
      <CoronaIcon size={16} />
    </RailButton>
  );
}
