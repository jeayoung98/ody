"use client";

import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { isConstellationOpen, useMapStore } from "@/stores/use-map-store";

/**
 * 고스트별 배너 (MAP-12). 고스트별은 이 겹에 없는 곡이라 지도를 아무리 밀어도 닿지 않는다 —
 * 그래서 "그 별로 가는 길"과 "끄는 길"을 화면 위에 둔다.
 */
export default function GhostBanner() {
  const ghostMusicId = useMapStore((s) => s.ghostMusicId);
  const surfaceToMusic = useMapStore((s) => s.surfaceToMusic);
  const dismissGhost = useMapStore((s) => s.dismissGhost);
  const nearbyOpen = useMapStore((s) => s.viewMode === "nearby");
  const constellationOpen = useMapStore(isConstellationOpen);
  const overlayOpen = nearbyOpen || constellationOpen;
  const { data } = useMusicDetailQuery(ghostMusicId);
  if (ghostMusicId == null) return null;

  return (
    <div
      className={`glass-liquid animate-tin pointer-events-auto absolute left-1/2 z-[23] flex -translate-x-1/2 items-center gap-2.5 rounded-pill! py-1.5 pr-1.5 pl-3.5 ${
        overlayOpen ? "top-[106px]" : "top-[62px]"
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-violet shadow-[0_0_8px_#a67cff]" />
      <span className="max-w-[220px] truncate text-[12px]">
        <b className="font-semibold">{data?.title ?? "고스트별"}</b>
        <span className="ml-1.5 text-ink-3">이 영역에 없는 곡</span>
      </span>
      <button
        type="button"
        onClick={() => surfaceToMusic(ghostMusicId)}
        className="rounded-pill bg-white/[.09] px-2.5 py-[5px] text-[11.5px] text-ink transition-colors hover:bg-white/[.16]"
      >
        이 별로 이동
      </button>
      <button
        type="button"
        aria-label="고스트별 끄기"
        onClick={dismissGhost}
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-pill text-[11px] text-ink-3 transition-colors hover:bg-white/[.09] hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
