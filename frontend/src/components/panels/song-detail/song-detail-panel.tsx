"use client";

import { useEffect, useRef } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import { useFeatures } from "@/hooks/use-features";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import SongActions from "./song-actions";
import SongCoverBackdrop from "./song-cover-backdrop";
import SongElsewhereNote from "./song-elsewhere-note";
import SongHeader from "./song-header";
import SongNearbyList from "./song-nearby-list";
import SongPcList from "./song-pc-list";
import SongRelatedPlaylists from "./song-related-playlists";
import SongReportButton from "./song-report-button";

/**
 * 시트 앞의 빈 칸 = 커버를 드러내는 창(px). 정사각 커버의 위쪽 절반쯤으로, 여기에 헤더 높이가
 * 더해져 **커버의 약 2/3**가 보인 채로 시작한다. 패널 폭(`--spacing-right-panel` 376px)이
 * 고정이라 커버 높이도 고정이다 — 폭이 달라지면 이 값도 같이 봐야 한다.
 */
const COVER_WINDOW = 188;

/**
 * 시트 윗머리에서 커버가 녹아드는 길이(px).
 *
 * 88px 로 뒀다가 **잘린 것처럼 보였다** (S15P21A405-384) — 짧으면 그라데이션이 끝나는 자리가
 * 선이 되고, 그 위로 커버가 갑자기 나타난다. 커버(정사각 ≈ 366px)의 절반을 넘게 써서 끝을
 * 흐린다. 커버 아래끝도 함께 흐려야 완성된다 (`song-cover-backdrop` 의 mask).
 */
const SHEET_FADE = 200;

/**
 * 곡 상세 (SONG-02).
 *
 * 두 겹이다 (S15P21A405-384).
 * - **뒤: 커버** — 패널 상단에 정사각형으로 고정. 스크롤해도 움직이지 않는다
 * - **앞: 시트** — 제목부터 주변 곡까지 전부. 위로 스크롤하면 이 시트가 커버를 덮으며 올라간다
 *
 * 시트 윗머리는 투명 → 배경색 그라데이션이라 커버가 시트로 녹아든다. 끝까지 올리면
 * 헤더 뒤의 커버까지 덮개가 지워서 패널이 한 색이 된다(`song-cover-backdrop`).
 */
export default function SongDetailPanel() {
  const musicId = usePanelStore((s) => s.musicId);
  const features = useFeatures();
  const { data, isPending, isError } = useMusicDetailQuery(musicId);
  // 이 겹에 없는 곡이면 고스트별로 띄운 상태다 — 이동 안내를 함께 보여준다 (MAP-12)
  const elsewhere = useMapStore((s) => s.selectedMusicId === musicId && s.ghostMusicId === musicId);
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * 곡이 바뀌면 **맨 위로 되돌린다** (S15P21A405-384). 패널은 곡이 바뀌어도 같은 상자를 쓰므로
   * 스크롤이 그대로 남는다 — 주변 음악 카드로 옮겨 다니면 새 곡의 제목·커버는 위에 있는데
   * 화면은 계속 아래에 머물러서 무엇이 열렸는지 안 보인다.
   *
   * DOM 에 직접 쓴다. 상태로 들고 있을 값이 아니고, 이 한 줄이면 커버 덮개도 스크롤 이벤트를
   * 받아 제자리로 돌아간다 (`song-cover-backdrop`).
   */
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [musicId]);

  return (
    <Box
      title="곡 상세"
      lead={<PanelBackButton />}
      // 기능 코드(SONG-02) 자리를 신고 버튼에 내줬다 (S15P21A405-384) — 코드는 개발자만 읽는다
      actions={
        <>
          {data && <SongReportButton musicId={data.id} title={data.title} />}
          <PanelCloseButton />
        </>
      }
      flush
      bodyRef={bodyRef}
      // 커버는 상세 응답을 기다리지 않는다 — musicId 만으로 그려지므로 여는 즉시 깔린다
      bg={musicId != null ? <SongCoverBackdrop musicId={musicId} scrollerRef={bodyRef} reveal={COVER_WINDOW} /> : undefined}
    >
      {/* 커버를 드러내는 창 */}
      <div aria-hidden style={{ height: COVER_WINDOW }} />
      {/* 바닥 여백을 넉넉히 — 마지막 카드 줄이 패널 밑변에 붙으면 잘린 것처럼 보인다 */}
      <div className="relative flex flex-col gap-3.5 px-[15px] pt-3.5 pb-7">
        {/* 시트 바닥 — 윗머리는 커버가 비치도록 투명에서 시작한다 */}
        <div aria-hidden style={{ height: SHEET_FADE }} className="pointer-events-none absolute inset-x-0 top-0 -z-10 bg-gradient-to-b from-transparent to-void-3" />
        <div aria-hidden style={{ top: SHEET_FADE }} className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 bg-void-3" />

        {isPending && <Loading />}
        {isError && <ErrorMessage />}
        {data && (
          <>
            <SongHeader music={data} />
            {elsewhere && <SongElsewhereNote musicId={data.id} />}
            <SongActions music={data} />
            <Divider />
            {/*
              정보 표(발매 국가·작곡가·곡 길이·장르·누적 재생 …)는 걷어냈다 (S15P21A405-384).
              올 값은 넷뿐이었고 그중 셋은 제목 아래 칩이 이미 말한다 — 같은 값을 두 번 보여
              주려고 표를 세울 이유가 없다. 안 오는 다섯 줄은 `-` 만 찍혀 고장처럼 보였다.
              BPM 은 칩에도 없어 이 화면에서 사라진 유일한 값이다.
            */}
            <SongPcList items={data.principalComponents} />
            <Divider />
            <SongNearbyList items={data.nearby} centerMusicId={data.id} />
            {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333) — 못 여는 플리 목록을 보여 주지 않는다 */}
            {features.playlist && <SongRelatedPlaylists items={data.relatedPlaylists} />}
          </>
        )}
      </div>
    </Box>
  );
}
