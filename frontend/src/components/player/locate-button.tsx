"use client";

import { LocateIcon } from "@/components/common/icons";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";
import { track } from "@/lib/analytics/client";

/**
 * 내 위치로 가기 — 재생으로 내 자리가 정해졌던 겹·화면으로 돌아간다 (MAP-08).
 *
 * **플레이어바에서 떼어 둔 이유는 다시 그리는 횟수다.** 이 버튼이 실제로 보는 것은 `canGoHome` 과
 * `viewMode` 둘뿐인데, 플레이어바 안에 있으면 곡·큐·재생 상태가 바뀔 때마다 같이 다시 그려졌다.
 * 누를 때 필요한 값(지금 듣는 곡 등)은 `getState()` 로 그때 읽는다 — 구독해 두면 그것까지 다시 그린다.
 */
export default function LocateButton() {
  const canGoHome = useMapStore((s) => s.canGoHome);

  /**
   * 지도를 지금 듣는 곡으로 옮기고 **우측 패널도 그 곡으로 맞춘다** (S15P21A405-328).
   * 데려다 놓기만 하고 패널이 아까 보던 곡이면 어디로 갔는지가 화면에 안 남는다.
   * 거부된 경우(따라가기)는 지도가 안 움직였으므로 패널도 그대로 둔다.
   * 임시 뷰는 스토어의 `goHome` 이 닫고 가므로 여기서 막지 않는다 (S15P21A405-445).
   */
  const handleClick = () => {
    const showToast = useToastStore.getState().show;
    const r = useMapStore.getState().goHome();
    track("map_locate_used", { outcome: r });
    if (r === "follow") showToast("따라가는 동안에는 화면을 옮길 수 없어요");
    else if (r !== "none") {
      const musicId = usePlayerStore.getState().currentMusicId;
      if (musicId != null) usePanelStore.getState().openSong(musicId);
    }
  };

  return (
    <button
      data-analytics-manual
      type="button"
      onClick={handleClick}
      disabled={!canGoHome}
      aria-label="내 위치로 가기"
      title="내 위치로 가기"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/10 hover:text-teal disabled:cursor-default disabled:text-ink-4 disabled:hover:bg-transparent"
    >
      <LocateIcon />
    </button>
  );
}
