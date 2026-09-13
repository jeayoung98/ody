"use client";

import { RadarIcon } from "@/components/common/icons";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";

/**
 * .act — 주변 탐색 모드 토글. 켜지면 줌인되며 기준 곡 주변의 모든 곡(대표곡 아니어도)을 보여준다.
 * 기준 곡: 선택된 곡 > 재생 중인 곡. 둘 다 없으면 비활성.
 *
 * 주변 탐색 **중에** 중심이 아닌 곡이 선택돼 있으면 **건너가기(항해)** 버튼이 된다 (S15P21A405-288) —
 * 고리 안 이웃을 누르는 것만으로는 옮겨가지 않으므로(선택·재생만), 옮겨가는 길은 여기 하나다.
 * 중심이 선택돼 있거나 아무것도 없으면 예전처럼 닫기.
 */
export default function NearbyExploreButton() {
  const viewMode = useMapStore((s) => s.viewMode);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const exitNearby = useMapStore((s) => s.exitNearby);

  const target = selectedMusicId ?? currentMusicId;
  const active = viewMode === "nearby";
  const hop = active && selectedMusicId != null && selectedMusicId !== nearbyCenterMusicId;

  const handleClick = () => {
    if (hop) enterNearby(selectedMusicId);
    else if (active) exitNearby();
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
      title={hop ? "선택한 곡 주변으로 건너가기" : "주변 탐색"}
      className={`glass inline-flex h-[52px] shrink-0 items-center gap-2 rounded-pill! px-[15px] text-sm whitespace-nowrap transition-all duration-fast hover:bg-glass-2 hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-violet/50! text-white shadow-glow-violet" : ""
      }`}
    >
      <RadarIcon className="opacity-70" />
      <span>{hop ? "이 곡 주변 보기" : "주변 탐색"}</span>
    </button>
  );
}
