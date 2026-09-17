"use client";

import { BackIcon } from "@/components/common/icons";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore, type PanelReturn } from "@/stores/use-panel-store";

/**
 * 곡 상세에서 목록(여정·플리)으로 돌아가는 버튼.
 *
 * 돌아갈 자리를 두 군데서 찾는다 (S15P21A405-316).
 * 1. **어떻게 들어왔나** — 목록에서 곡을 눌러 들어왔거나 주변 음악 카드로 이웃에 들어왔으면
 *    `back` 이 잡혀 있다 (S15P21A405-384)
 * 2. **지금 무엇을 듣고 있나** — 여정·플리가 진행 중이고 이 곡이 그 목록 안에 있으면,
 *    지도에서 바로 눌러 열었더라도 돌아갈 자리가 있다
 *
 * 2번이 없으면 여정 중에 지도에서 그 여정의 별을 눌렀을 때 목록으로 못 돌아간다.
 * 돌아갈 자리가 둘 다 없으면 **아무것도 그리지 않는다.**
 *
 * **어디로 가는지 글자로 적는다** (S15P21A405-384). 화살표만 있으면 눌러 보기 전에는 어디로
 * 가는지 알 수 없다 — 특히 주변 음악 카드를 타고 들어온 경우는 "직전 곡" 이 무엇인지가
 * 곧 그 버튼의 뜻이다. 툴팁은 마우스를 올려야 보여서 이 몫을 못 한다.
 */
export default function PanelBackButton() {
  const back = usePanelStore((s) => s.back);
  const musicId = usePanelStore((s) => s.musicId);
  const goBack = usePanelStore((s) => s.goBack);
  const openJourney = usePanelStore((s) => s.openJourney);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const ids = useMapStore((s) => s.constellationMusicIds);
  const source = useMapStore((s) => s.constellationSource);

  // 지금 켜져 있는 목록 안의 곡인가
  const inList = musicId != null && source != null && ids.includes(musicId);
  const target: PanelReturn | null = back ?? (inList && source.kind === "journey" ? { panel: "journey" } : inList && source.kind === "playlist" ? { panel: "playlist", playlistId: source.playlistId } : null);
  // 돌아갈 곡의 제목. 상세를 방금까지 보던 곡이라 캐시에 있다
  const backMusicId = target?.panel === "song" ? target.musicId : null;
  const { data: backSong } = useMusicDetailQuery(backMusicId);
  if (!target) return null;

  const label = target.panel === "song" ? (backSong?.title ?? "직전 곡") : target.panel === "journey" ? "여정" : "플레이리스트";

  const handle = () => {
    // 들어온 기록이 있으면 그 길로, 없으면 지금 듣고 있는 목록을 연다
    if (back) goBack();
    else if (target.panel === "song") return;
    else if (target.panel === "journey") openJourney();
    else openPlaylist(target.playlistId);
  };

  return (
    <button
      type="button"
      onClick={handle}
      title={`${label}(으)로 돌아가기`}
      aria-label={`${label}(으)로 돌아가기`}
      className="-ml-1 inline-flex min-w-0 max-w-[150px] items-center gap-1 rounded-pill px-1.5 py-1 text-ink-3 transition-colors duration-fast hover:bg-glass-2 hover:text-ink"
    >
      <BackIcon size={12} />
      <span className="truncate text-[11px]">{label}</span>
    </button>
  );
}
