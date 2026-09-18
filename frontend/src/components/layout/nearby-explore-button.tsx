"use client";

import { CoronaIcon } from "@/components/common/icons";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import NavActionButton from "./nav-action-button";

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

  const target = selectedMusicId ?? currentMusicId;
  const active = viewMode === "nearby";
  const disabled = !active && target == null;

  const handleClick = () => {
    if (active) exitNearby();
    else if (target != null) {
      enterNearby(target);
      useTutorialStore.getState().complete("nearby");
    }
  };

  return (
    <NavActionButton
      label="주변 탐색"
      active={active}
      disabled={disabled}
      // 상단에 올라온 뒤로 "왜 안 눌리지" 가 더 눈에 띈다 — 이유를 바로 말한다
      title={disabled ? "곡을 먼저 고르세요" : active ? "주변 탐색 닫기" : "주변 탐색"}
      onClick={handleClick}
      data-tutorial="nearby"
    >
      <CoronaIcon className="opacity-80" />
    </NavActionButton>
  );
}
