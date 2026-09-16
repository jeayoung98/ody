"use client";

import SectionTitle from "@/components/common/section-title";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicDetail } from "@/types";

/** 관련 플레이리스트. 누르면 우측 패널이 플레이리스트로 바뀐다 */
export default function SongRelatedPlaylists({ items }: { items: MusicDetail["relatedPlaylists"] }) {
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>관련 플레이리스트</SectionTitle>
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
