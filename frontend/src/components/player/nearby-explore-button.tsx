"use client";

import { RadarIcon } from "@/components/common/icons";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";

/**
 * .act — 주변 탐색 모드 토글. 켜지면 줌인되며 기준 곡 주변의 모든 곡(대표곡 아니어도)을 보여준다.
 * 기준 곡: 선택된 곡 > 재생 중인 곡. 둘 다 없으면 비활성.
 *
 * 켜기/닫기 **토글만** 한다. 주변 탐색 중 다른 이웃으로 건너가는 것(항해)은 선택한 별 곁에 붙는
 * "여기서 둘러보기" 칩({@link HopChip})이 맡는다 (S15P21A405-288) — 한 버튼이 두 뜻을 갖지 않게
 */
export default function NearbyExploreButton() {
  const viewMode = useMapStore((s) => s.viewMode);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const exitNearby = useMapStore((s) => s.exitNearby);

  const target = selectedMusicId ?? currentMusicId;
  const active = viewMode === "nearby";

  const handleClick = () => {
    if (active) exitNearby();
    else if (target != null) {
      enterNearby(target);
      useTutorialStore.getState().complete("nearby");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!active && target == null}
      title="주변 탐색"
      className={`glass inline-flex h-[52px] shrink-0 items-center gap-2 rounded-pill! px-[15px] text-sm whitespace-nowrap transition-all duration-fast hover:bg-glass-2 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-violet/50! text-white shadow-glow-violet" : ""
      }`}
    >
      <RadarIcon className="opacity-70" />
      <span>주변 탐색</span>
    </button>
  );
}
