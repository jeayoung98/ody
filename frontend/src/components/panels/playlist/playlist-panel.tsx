"use client";

import { useEffect } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import { useMyPlaylistsQuery } from "@/hooks/queries/use-my-playlists-query";
import { usePlaylistDetailQuery } from "@/hooks/queries/use-playlist-detail-query";
import { musicToMapPoint } from "@/lib/map-point";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MapPoint } from "@/types";
import PanelCloseButton from "../panel-close-button";
import PlaylistHeader from "./playlist-header";
import PlaylistSkeleton from "./playlist-skeleton";
import PlaylistTrackList from "./playlist-track-list";

/**
 * 플레이리스트 상세 (PATH-06).
 * 패널을 열면 좌상단에 `별자리 뷰` 택이 생기고, 그 택으로 모양을 펼쳐 본다 (PATH-01).
 */
export default function PlaylistPanel() {
  const playlistId = usePanelStore((s) => s.playlistId);
  const { data, isPending, isError } = usePlaylistDetailQuery(playlistId);
  /**
   * 내 플리인가 — **내 목록에 있는지로 판단한다** (S15P21A405-540).
   *
   * 예전에는 상세 응답의 `email` 을 내 이메일과 견줬는데, **그 값이 늘 `null` 이다.** 백엔드
   * `PlaylistDetailResponse` 에 소유자가 없어서 BFF 가 비워 두기 때문이다. 그래서 `isMine` 이
   * 항상 false 였고, 곡 삭제 버튼이 **자기 플리에서도 안 보였다.**
   *
   * 내 플리 목록은 `id` 를 주므로 백엔드 변경 없이 지금 판단할 수 있다. 그 목록은 다른 화면
   * (＋ 플리 메뉴)도 쓰는 같은 쿼리라 요청이 더 나가지도 않는다.
   * 상세 응답에 소유자가 생기면 그 값을 쓰는 쪽이 낫다 — BACKEND-NOTES 로 올려 뒀다.
   */
  const { data: myPlaylists } = useMyPlaylistsQuery();
  const isMine = data != null && (myPlaylists?.some((p) => p.id === data.id) ?? false);
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
    <Box title="플레이리스트" actions={<PanelCloseButton />}>
      {isPending && <PlaylistSkeleton />}
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
