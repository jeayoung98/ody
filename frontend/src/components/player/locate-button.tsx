"use client";

import { useQueryClient } from "@tanstack/react-query";
import { HOME_LOOKUP_FAILED, HOME_NO_COORDS, RIDING_MAP_LOCKED } from "@/constants";

import { LocateIcon } from "@/components/common/icons";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { useBackToMap } from "@/hooks/use-back-to-map";
import { musicDetailQueryOptions } from "@/hooks/queries/use-music-detail-query";
import { musicToMapPoint } from "@/lib/map-point";
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
   * 재생바는 **모든 탭에 떠 있다** (S15P21A405-417). 랭킹이나 마이페이지를 보다 이걸 누르면
   * 지도는 그 화면 뒤에서 움직이고 화면에는 아무 일도 안 일어난 것처럼 보인다 —
   * 누르는 순간 지도 탭으로 옮겨 간다. "내 위치로 가기" 는 곧 지도로 가겠다는 뜻이다.
   */
  const backToMap = useBackToMap();
  const queryClient = useQueryClient();

  /**
   * 지도를 지금 듣는 곡으로 옮기고 **우측 패널도 그 곡으로 맞춘다** (S15P21A405-328).
   * 데려다 놓기만 하고 패널이 아까 보던 곡이면 어디로 갔는지가 화면에 안 남는다.
   * 거부된 경우(따라가기)는 지도가 안 움직였으므로 패널도 그대로 둔다.
   * 임시 뷰는 스토어의 `goHome` 이 닫고 가므로 여기서 막지 않는다 (S15P21A405-445).
   *
   * **지도가 그 곡의 좌표를 모르면 곡 상세에서 받아 넣고 다시 간다** (S15P21A405-670). 겹 상주 집합은
   * 서버가 고른 top-k 라 랭킹·검색·플리에서 튼 곡은 지도에 없는 경우가 흔하고, 새로고침으로 되살린
   * 자리도 마찬가지다 — 예전에는 그때 버튼이 말없이 꺼져 있었다. 좌표가 아예 없는 곡이면 토스트로 말한다.
   */
  const handleClick = async () => {
    const showToast = useToastStore.getState().show;
    let r = useMapStore.getState().goHome();
    if (r === "unknown") r = await goHomeWithCoords(showToast);
    track("map_locate_used", { outcome: r });
    backToMap();
    if (r === "follow") showToast(RIDING_MAP_LOCKED);
    else if (r === "none") showToast(HOME_LOOKUP_FAILED);
    else if (r !== "unknown") {
      // 겹을 건너 찾아가는 중이면 도착했을 때 연다 (`use-home-travel-panel`). 지금 겹 안이면 바로 (S15P21A405-670)
      if (getMapEngine()?.isHomeTraveling()) return;
      const musicId = usePlayerStore.getState().currentMusicId;
      if (musicId != null) usePanelStore.getState().openSong(musicId);
    }
  };

  /** 곡 상세의 `location` 으로 좌표를 편입하고 다시 간다. 못 구하면 토스트를 띄우고 `"unknown"` 그대로 */
  async function goHomeWithCoords(showToast: (m: string) => void) {
    const musicId = useMapStore.getState().home?.musicId;
    const engine = getMapEngine();
    if (musicId == null || !engine) return "none" as const;
    try {
      const point = musicToMapPoint(await queryClient.fetchQuery(musicDetailQueryOptions(musicId)));
      if (!point) {
        showToast(HOME_NO_COORDS);
        return "unknown" as const;
      }
      engine.adopt([point]);
    } catch {
      showToast(HOME_LOOKUP_FAILED);
      return "unknown" as const;
    }
    return useMapStore.getState().goHome();
  }

  return (
    <button
      data-analytics-manual
      type="button"
      onClick={handleClick}
      disabled={!canGoHome}
      aria-label="내 위치로 가기"
      title="내 위치로 가기"
      /*
       * 폰에서는 **손가락이 닿는 넓이만** 넓힌다 (S15P21A405-417). 보이는 크기는 32 그대로라
       * 재생바 줄이 안 흔들리고, 투명한 판이 위아래·좌우로 6px 씩 더해 44 를 만든다
       * (`--spacing-touch`). 32px 짜리 과녁은 손가락으로 겨누기에 작다.
       */
      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/10 hover:text-teal disabled:cursor-default disabled:text-ink-4 disabled:hover:bg-transparent max-tablet:after:absolute max-tablet:after:-inset-1.5 max-tablet:after:content-['']"
    >
      <LocateIcon />
    </button>
  );
}
