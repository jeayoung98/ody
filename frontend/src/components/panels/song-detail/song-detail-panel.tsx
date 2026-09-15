"use client";

import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import { FEATURES } from "@/constants";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import SongActions from "./song-actions";
import SongElsewhereNote from "./song-elsewhere-note";
import SongHeader from "./song-header";
import SongInfoGrid from "./song-info-grid";
import SongNearbyList from "./song-nearby-list";
import SongPcList from "./song-pc-list";
import SongRelatedPlaylists from "./song-related-playlists";

/** 곡 상세 (SONG-02) */
export default function SongDetailPanel() {
  const musicId = usePanelStore((s) => s.musicId);
  const { data, isPending, isError } = useMusicDetailQuery(musicId);
  // 이 겹에 없는 곡이면 고스트별로 띄운 상태다 — 이동 안내를 함께 보여준다 (MAP-12)
  const elsewhere = useMapStore((s) => s.selectedMusicId === musicId && s.ghostMusicId === musicId);

  return (
    <Box title="곡 상세" code="SONG-02" lead={<PanelBackButton />} actions={<PanelCloseButton />}>
      {isPending && <Loading />}
      {isError && <ErrorMessage />}
      {data && (
        <>
          <SongHeader music={data} />
          {elsewhere && <SongElsewhereNote musicId={data.id} />}
          <SongActions music={data} />
          <Divider />
          <SongInfoGrid music={data} />
          <SongPcList items={data.principalComponents} />
          <Divider />
          <SongNearbyList items={data.nearby} centerMusicId={data.id} />
          {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333) — 못 여는 플리 목록을 보여 주지 않는다 */}
          {FEATURES.playlist && <SongRelatedPlaylists items={data.relatedPlaylists} />}
        </>
      )}
    </Box>
  );
}
