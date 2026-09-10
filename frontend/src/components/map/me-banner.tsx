"use client";

import { isConstellationOpen, useMapStore } from "@/stores/use-map-store";

/**
 * 내 위치가 화면 밖일 때 뜨는 배너 (MAP-08).
 * 플레이리스트·여정으로 듣다 보면 내 자리(재생 중인 곡)가 보는 영역 밖으로 나간다 —
 * 고스트별과 같은 방식으로 구름 밖에 표식을 찍고, 여기서 눌러 찾아간다.
 */
export default function MeBanner() {
  const meOffscreen = useMapStore((s) => s.meOffscreen);
  const ghostMusicId = useMapStore((s) => s.ghostMusicId);
  const focusMe = useMapStore((s) => s.focusMe);
  const nearbyOpen = useMapStore((s) => s.viewMode === "nearby");
  const constellationOpen = useMapStore(isConstellationOpen);
  if (!meOffscreen) return null;

  // 오버레이 닫기 버튼·고스트별 배너와 세로로 겹치지 않게 아래로 내려간다
  const top = nearbyOpen || constellationOpen ? (ghostMusicId != null ? "top-[150px]" : "top-[106px]") : ghostMusicId != null ? "top-[106px]" : "top-[62px]";

  return (
    <div className={`glass animate-tin pointer-events-auto absolute left-1/2 z-[23] flex -translate-x-1/2 items-center gap-2.5 rounded-pill! py-1.5 pr-1.5 pl-3.5 ${top}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-teal shadow-[0_0_8px_#4fe3ce]" />
      <span className="text-[12px]">
        내 위치가 <b className="font-semibold">화면 밖</b>이에요
      </span>
      <button
        type="button"
        onClick={focusMe}
        className="rounded-pill bg-white/[.09] px-2.5 py-[5px] text-[11.5px] text-ink transition-colors hover:bg-white/[.16]"
      >
        내 위치로
      </button>
    </div>
  );
}
