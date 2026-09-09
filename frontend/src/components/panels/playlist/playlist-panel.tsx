"use client";

import { useEffect, useMemo } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { usePlaylistDetailQuery } from "@/hooks/queries/use-playlist-detail-query";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelCloseButton from "../panel-close-button";
import PlaylistHeader from "./playlist-header";
import PlaylistTrackList from "./playlist-track-list";

/**
 * 플레이리스트 상세 (PATH-06).
 * 재생하지 않아도 열기만 하면 곡들이 별자리로 뜬다 — 다른 별자리를 재생 중이면 그쪽은 흐려진다 (PATH-01).
 */
export default function PlaylistPanel() {
  const playlistId = usePanelStore((s) => s.playlistId);
  const { data, isPending, isError } = usePlaylistDetailQuery(playlistId);
  const { data: me } = useMeQuery();
  const isMine = !!data && !!me && data.email === me.email;
  const previewConstellation = useMapStore((s) => s.previewConstellation);
  const clearPreview = useMapStore((s) => s.clearPreview);

  const musicIds = useMemo(() => data?.items.map((it) => it.musicId) ?? [], [data]);
  useEffect(() => {
    if (musicIds.length >= 2) previewConstellation(musicIds);
  }, [musicIds, previewConstellation]);
  // 패널을 닫으면 미리보기도 걷힌다 (재생 중이던 별자리는 그대로 남는다)
  useEffect(() => clearPreview, [clearPreview]);

  return (
    <Box title="플레이리스트" code="PATH-06" actions={<PanelCloseButton />}>
      {isPending && <Loading />}
      {isError && <ErrorMessage />}
      {data && (
        <>
          <PlaylistHeader playlist={data} />
          <Divider />
          <PlaylistTrackList playlist={data} editable={isMine} />
        </>
      )}
    </Box>
  );
}
