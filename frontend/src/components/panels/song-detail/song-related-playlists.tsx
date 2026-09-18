"use client";

import EmptyState from "@/components/common/empty-state";
import SectionTitle from "@/components/common/section-title";
import CreatePlaylistForm from "@/components/panels/playlist/create-playlist-form";
import { useAddPlaylistItemMutation } from "@/hooks/mutations/use-add-playlist-item-mutation";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicDetail } from "@/types";

/**
 * 관련 플레이리스트 탭 (S15P21A405-435). 누르면 우측 패널이 플레이리스트로 바뀐다.
 *
 * **비어 있어도 탭은 산다.** 이 곡이 담긴 플리가 없으면 "없다" 로 끝내지 않고 여기서 바로
 * 이 곡으로 새 플리를 만들게 한다 — 만들면 곡을 담고 그 플리로 넘어간다.
 */
export default function SongRelatedPlaylists({ items, musicId }: { items: MusicDetail["relatedPlaylists"]; musicId: number }) {
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const add = useAddPlaylistItemMutation();
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        <EmptyState message="이 곡이 담긴 플레이리스트가 아직 없어요." />
        <SectionTitle>이 곡으로 새 플레이리스트 만들기</SectionTitle>
        <CreatePlaylistForm onCreated={(p) => add.mutate({ playlistId: p.id, musicId }, { onSuccess: () => openPlaylist(p.id) })} />
      </div>
    );
  }
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
