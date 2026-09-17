"use client";

import Box from "@/components/common/box";
import EmptyState from "@/components/common/empty-state";
import Loading from "@/components/common/loading";
import { useAddPlaylistItemMutation } from "@/hooks/mutations/use-add-playlist-item-mutation";
import { useMyPlaylistsQuery } from "@/hooks/queries/use-my-playlists-query";
import CreatePlaylistForm from "./create-playlist-form";

interface AddToPlaylistMenuProps {
  musicId: number;
  onDone: () => void;
}

/** 내 플레이리스트 중 하나에 곡 추가, 또는 새 플레이리스트 생성 후 추가 (SONG-05, PATH-04) */
export default function AddToPlaylistMenu({ musicId, onDone }: AddToPlaylistMenuProps) {
  const { data, isPending } = useMyPlaylistsQuery();
  const add = useAddPlaylistItemMutation();

  const handleAdd = (playlistId: number) => {
    add.mutate({ playlistId, musicId }, { onSuccess: onDone });
  };

  return (
    <div className="absolute top-full left-0 z-20 mt-2 w-full">
      <Box title="플레이리스트에 추가" flush className="shadow-[0_24px_60px_-20px_#000]">
        <div className="max-h-56 overflow-y-auto p-1.5">
          {isPending && <Loading />}
          {data && data.length === 0 && <EmptyState message="아직 플레이리스트가 없어요." />}
          {data?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleAdd(p.id)}
              disabled={add.isPending}
              className="flex w-full items-center justify-between rounded-box-sm border border-transparent px-[9px] py-2 text-left text-sm transition-colors hover:border-line hover:bg-white/[.055]"
            >
              <span className="truncate">{p.playlistName}</span>
              <span className="num text-[10px] text-ink-3">{p.itemCount}곡 · ＋</span>
            </button>
          ))}
        </div>
        <div className="border-t border-line p-2.5">
          <CreatePlaylistForm onCreated={(p) => handleAdd(p.id)} />
        </div>
      </Box>
    </div>
  );
}
