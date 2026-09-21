"use client";

import EmptyState from "@/components/common/empty-state";
import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import PlaylistRow from "@/components/common/playlist-row";
import SectionTitle from "@/components/common/section-title";
import SkeletonRows from "@/components/common/skeleton-rows";
import { useDeletePlaylistMutation } from "@/hooks/mutations/use-delete-playlist-mutation";
import { useMyPlaylistsQuery } from "@/hooks/queries/use-my-playlists-query";
import { usePanelStore } from "@/stores/use-panel-store";
import CreatePlaylistForm from "../playlist/create-playlist-form";

/** [내 플리] 삭제/추가/수정 가능 (플리뷰) */
export default function FeedMyPlaylists() {
  const { data, isPending } = useMyPlaylistsQuery();
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const remove = useDeletePlaylistMutation();

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={data ? `${data.length}개` : undefined}>내 플레이리스트</SectionTitle>
      <CreatePlaylistForm />
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {isPending && <SkeletonRows count={3} />}
        {data && data.length === 0 && <EmptyState message="아직 플레이리스트가 없어요." />}
        {data?.map((p) => (
          <PlaylistRow
            key={p.id}
            playlist={p}
            onClick={() => openPlaylist(p.id)}
            actions={
              <IconButton
                label="삭제"
                size={26}
                disabled={remove.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(p.id);
                }}
              >
                <CloseIcon size={13} />
              </IconButton>
            }
          />
        ))}
      </div>
    </div>
  );
}
