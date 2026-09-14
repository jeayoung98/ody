"use client";

import { useEffect } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { usePlaylistDetailQuery } from "@/hooks/queries/use-playlist-detail-query";
import { musicToMapPoint } from "@/lib/map-point";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MapPoint } from "@/types";
import PanelCloseButton from "../panel-close-button";
import PlaylistHeader from "./playlist-header";
import PlaylistTrackList from "./playlist-track-list";

/**
 * 플레이리스트 상세 (PATH-06).
 * 패널을 열면 좌상단에 `별자리 뷰` 택이 생기고, 그 택으로 모양을 펼쳐 본다 (PATH-01).
 */
export default function PlaylistPanel() {
  const playlistId = usePanelStore((s) => s.playlistId);
  const { data, isPending, isError } = usePlaylistDetailQuery(playlistId);
  const { data: me } = useMeQuery();
  const isMine = !!data && !!me && data.email === me.email;
  const setConstellationList = useMapStore((s) => s.setConstellationList);

  // 뷰를 켜지는 않고 목록만 걸어둔다 — 켜는 건 사용자가 택을 눌렀을 때
  const items = data?.items;
  useEffect(() => {
    if (!items || items.length < 2 || playlistId == null) return;
    // 목록이 어디서 왔는지 함께 남긴다 — 이 안의 곡을 누르면 단일 재생이 아니라 이 플리로 이어진다.
    // 좌표도 함께 넘긴다 (S15P21A405-214) — 이 겹 상주 집합 밖의 곡은 좌표가 있어야 별자리에 그려진다.
    // 좌표가 없는 곡은 빼고 넘긴다 (0 으로 채우면 원점에 뭉친다)
    setConstellationList(
      items.map((it) => it.musicId),
      items.map((it) => musicToMapPoint(it.music)).filter((p): p is MapPoint => p != null),
      { kind: "playlist", playlistId },
    );
  }, [items, playlistId, setConstellationList]);

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
