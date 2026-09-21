"use client";

import EmptyState from "@/components/common/empty-state";
import SkeletonRows from "@/components/common/skeleton-rows";
import TrackRow from "@/components/common/track-row";
import { usePlaylistRankingQuery } from "@/hooks/queries/use-ranking-query";
import { usePanelStore } from "@/stores/use-panel-store";

export default function PlaylistRankingList() {
  const { data, isPending } = usePlaylistRankingQuery();
  const openPlaylist = usePanelStore((s) => s.openPlaylist);

  if (isPending) return <SkeletonRows count={5} thumb="none" />;
  if (!data || data.length === 0) return <EmptyState message="아직 랭킹이 없어요." />;

  return (
    <>
      {data.map((p) => (
        <TrackRow
          key={p.playlistId}
          index={p.rank}
          title={p.playlistName}
          artist={p.ownerNickname}
          right={`♥ ${p.likeCnt.toLocaleString()}`}
          onClick={() => openPlaylist(p.playlistId)}
        />
      ))}
    </>
  );
}
