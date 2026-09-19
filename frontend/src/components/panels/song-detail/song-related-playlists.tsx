"use client";

import SectionTitle from "@/components/common/section-title";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicDetail } from "@/types";

/**
 * 이 곡이 담긴 플레이리스트 (S15P21A405-435). 누르면 우측 패널이 그 플레이리스트로 바뀐다.
 *
 * **비어 있으면 부르는 쪽이 이 칸을 통째로 뺀다** (S15P21A405-477) — 그래서 여기엔 빈 상태가
 * 없다. 탭이던 시절에는 빈 탭에 "이 곡으로 새 플리 만들기" 를 뒀지만, 한 장으로 편 뒤로는
 * 그 권유가 주변곡과 소리 사이에 늘 끼어든다. 만들기는 제목 줄의 플리 버튼에 있다.
 */
export default function SongRelatedPlaylists({ items }: { items: MusicDetail["relatedPlaylists"] }) {
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>이 곡이 담긴 플레이리스트</SectionTitle>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openPlaylist(p.id)}
            className="flex w-full items-center gap-2.5 rounded-box-sm border border-transparent px-[9px] py-2 text-left text-sm transition-colors hover:border-line hover:bg-white/[.055]"
          >
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] text-xs shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]" style={{ background: "linear-gradient(140deg,#12203c,#1b1330)" }}>
              ♪
            </span>
            <span className="min-w-0 flex-1 truncate">{p.playlistName}</span>
            <span className="text-ink-4">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
