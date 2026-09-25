"use client";

import { useFollowStore } from "@/stores/use-follow-store";
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
 * | 기본 · 볼 목록 없음 | **아무것도 안 그린다** |
 * | 기본 · 볼 목록 있음 | 흐린 `별자리 뷰 n곡`. 누르면 켠다 |
 * | 주변 탐색 | 청록 `주변 탐색 뷰` + ✕. 칩을 누르면 끈다 |
 * | 별자리 | 보라 `별자리 뷰 n/m` + ✕. 칩을 누르면 끈다 |
 *
 * **기본 상태에서는 칩이 사라진다** (S15P21A405-477). `기본 뷰` 라고 적어 두는 건 "지금 아무
 * 일도 일어나지 않았다" 는 말을 화면 한 칸을 써서 하는 것이다 — 뷰를 켰다 껐다 할 수 있을
 * 때만(여정·플리 목록이 걸려 있을 때) 그 스위치로 선다.
 *
 * 세 상태 모두 **칩 전체가 버튼**이다 (S15P21A405-457) — ✕ 는 표식일 뿐이다.
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
  /** 따라가는 동안 뷰는 인솔자 것이다 (S15P21A405-653, B-5) — 여기서 끄면 다음 알림까지 인솔자와 다른 화면이 된다 */
  const riding = useFollowStore((s) => s.leaderEmail != null);

  const nearby = viewMode === "nearby";
  const constellation = viewMode === "constellation";
  /** 켤 수 있는 목록이 있나 — 두 곡은 있어야 잇는 선이 된다 */
  const canOpen = ids.length >= 2;

  const cursor = currentMusicId == null ? -1 : ids.indexOf(currentMusicId);
  const count = cursor >= 0 ? `${cursor + 1}/${ids.length}` : `${ids.length}곡`;

  const label = nearby ? "주변 탐색 뷰" : "별자리 뷰";
  const on = nearby || constellation;
  const dot = nearby ? "bg-teal shadow-[0_0_8px_#4fe3ce]" : constellation ? "bg-violet shadow-[0_0_8px_#a67cff]" : "bg-violet/40";
  const tone = nearby ? "border-teal/40 text-ink shadow-glow-teal" : constellation ? "border-violet/45 text-ink shadow-glow-violet" : "text-ink-2";

  /** 기본 상태에서 누르면 별자리를 켜고 그 목록의 패널도 같이 연다 */
  const openConstellation = () => {
    if (!canOpen) return;
    toggleConstellation();
    if (source?.kind === "journey") openJourney();
    else if (source?.kind === "playlist") openPlaylist(source.playlistId);
  };

  const turnOff = nearby ? exitNearby : toggleConstellation;

  /**
   * **칩 전체가 버튼이다** (S15P21A405-457). 켜져 있으면 끄고, 꺼져 있고 켤 목록이 있으면 켠다.
   * 예전에는 켜져 있을 때 안의 ✕ 만 먹었다 — 칩은 누를 만한 크기인데 그 안의 10px 만 눌리는
   * 게 이유가 없다. 눌 데가 없으면 `null` 이고, 그때는 칩이 그냥 표시가 된다.
   */
  const press = riding ? null : on ? turnOff : canOpen ? openConstellation : null;
  const hint = riding ? "따라가는 동안은 인솔자의 화면을 같이 봐요" : on ? `${label} 끄기` : press ? "별자리 뷰 켜기" : undefined;

  // 켜져 있지도, 켤 수 있지도 않으면 그릴 것이 없다
  if (!on && !canOpen) return null;

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      <span
        className={`glass group inline-flex items-center gap-1.5 rounded-pill! px-2.5 py-[5px] text-[13.5px] transition-colors duration-fast ${tone} ${
          press ? "cursor-pointer hover:border-line-2 hover:text-ink" : ""
        }`}
        onClick={press ?? undefined}
        role={press ? "button" : undefined}
        tabIndex={press ? 0 : undefined}
        onKeyDown={press ? (e) => (e.key === "Enter" || e.key === " ") && press() : undefined}
        title={hint}
        aria-label={hint}
      >
        <span className={`h-1 w-1 rounded-pill ${dot}`} />
        {label}
        {/* 꺼져 있어도 몇 곡짜리 목록인지는 알려 준다 — 켤지 말지의 근거다 */}
        {(constellation || !on) && <span className="num text-ink-3">{count}</span>}
        {/*
          닫는 길임을 보이는 **표식**이다 — 버튼이 아니다. 칩 안에 또 버튼을 두면 클릭이 위로
          번져 핸들러가 두 번 돌고, 별자리 뷰는 토글이라 껐다가 그 자리에서 다시 켜진다.
        */}
        {on && !riding && <span aria-hidden className="ml-0.5 text-ink-3 transition-colors group-hover:text-ink">✕</span>}
      </span>
    </div>
  );
}
