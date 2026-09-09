"use client";

import EmptyState from "@/components/common/empty-state";
import Loading from "@/components/common/loading";
import PlaylistRow from "@/components/common/playlist-row";
import SectionTitle from "@/components/common/section-title";
import { useLikedPlaylistsQuery } from "@/hooks/queries/use-liked-playlists-query";
import { usePanelStore } from "@/stores/use-panel-store";

/** [좋아요한 플리] (플리뷰) */
export default function FeedLikedPlaylists() {
  const { data, isPending } = useLikedPlaylistsQuery();
  const openPlaylist = usePanelStore((s) => s.openPlaylist);

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={data ? `${data.length}개` : undefined}>좋아요한 플레이리스트</SectionTitle>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {isPending && <Loading />}
        {data && data.length === 0 && <EmptyState message="좋아요한 플레이리스트가 없어요." />}
        {data?.map((p) => <PlaylistRow key={p.id} playlist={p} onClick={() => openPlaylist(p.id)} />)}
      </div>
    </div>
  );
}
