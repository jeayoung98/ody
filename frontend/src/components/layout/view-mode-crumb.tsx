"use client";

import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * .crumb — 지금 어떤 뷰인지, 그리고 거기서 나가는 길 (PATH-01-1).
 *
 * **칩 하나로 셋을 다 보여준다** (S15P21A405-316). 예전에는 `기본 뷰` 크럼 · `별자리 뷰` 택 ·
 * 상단 중앙 `닫기` 버튼으로 흩어져 있어서, 같은 상태를 세 군데서 읽고 두 군데서 껐다.
 *
 * | 상태 | 칩 |
 * | --- | --- |
 * | 기본 | 회색 `기본 뷰`. 볼 목록이 있으면 눌러서 별자리를 켠다 |
 * | 주변 탐색 | 청록 `주변 탐색 뷰` + ✕ |
 * | 별자리 | 보라 `별자리 뷰 n/m` + ✕ |
 *
 * 별자리를 켜면 **그 목록의 패널도 같이 연다.** 별자리는 패널에 딸린 화면이라 혼자 뜨면
 * 지도만 가린 채 남는다 (패널을 닫으면 별자리도 꺼진다 — `use-panel-store`).
 */
export default function ViewModeCrumb() {
  const viewMode = useMapStore((s) => s.viewMode);
  const exitNearby = useMapStore((s) => s.exitNearby);
  const toggleConstellation = useMapStore((s) => s.toggleConstellationView);
  const ids = useMapStore((s) => s.constellationMusicIds);
  const source = useMapStore((s) => s.constellationSource);
  const openJourney = usePanelStore((s) => s.openJourney);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);

  const nearby = viewMode === "nearby";
  const constellation = viewMode === "constellation";
  /** 켤 수 있는 목록이 있나 — 두 곡은 있어야 잇는 선이 된다 */
  const canOpen = ids.length >= 2;

  const cursor = currentMusicId == null ? -1 : ids.indexOf(currentMusicId);
  const count = cursor >= 0 ? `${cursor + 1}/${ids.length}` : `${ids.length}곡`;

  const label = nearby ? "주변 탐색 뷰" : constellation ? "별자리 뷰" : "기본 뷰";
  const on = nearby || constellation;
  const dot = nearby ? "bg-teal shadow-[0_0_8px_#4fe3ce]" : constellation ? "bg-violet shadow-[0_0_8px_#a67cff]" : "bg-ink-4";
  const tone = nearby ? "border-teal/40 text-ink shadow-glow-teal" : constellation ? "border-violet/45 text-ink shadow-glow-violet" : "text-ink-2";

  /** 기본 상태에서 누르면 별자리를 켜고 그 목록의 패널도 같이 연다 */
  const openConstellation = () => {
    if (!canOpen) return;
    toggleConstellation();
    if (source?.kind === "journey") openJourney();
    else if (source?.kind === "playlist") openPlaylist(source.playlistId);
  };

  const turnOff = nearby ? exitNearby : toggleConstellation;

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      <span
        className={`glass inline-flex items-center gap-1.5 rounded-pill! px-2.5 py-[5px] text-[11.5px] transition-colors duration-fast ${tone} ${
          !on && canOpen ? "cursor-pointer hover:border-line-2 hover:text-ink" : ""
        }`}
        // 꺼져 있고 켤 목록이 있을 때만 칩 전체가 버튼이 된다
        onClick={!on && canOpen ? openConstellation : undefined}
        role={!on && canOpen ? "button" : undefined}
        tabIndex={!on && canOpen ? 0 : undefined}
        onKeyDown={!on && canOpen ? (e) => (e.key === "Enter" || e.key === " ") && openConstellation() : undefined}
        title={!on && canOpen ? "별자리 뷰 켜기" : undefined}
      >
        <span className={`h-1 w-1 rounded-pill ${dot}`} />
        {label}
        {constellation && <span className="num text-ink-3">{count}</span>}
        {/* 꺼져 있어도 볼 목록이 있으면 몇 곡인지는 알려 준다 */}
        {!on && canOpen && <span className="num text-ink-3">{count}</span>}
        {on && (
          <button type="button" onClick={turnOff} className="ml-0.5 text-ink-3 transition-colors hover:text-ink" aria-label={`${label} 끄기`}>
            ✕
          </button>
        )}
      </span>
    </div>
  );
}
