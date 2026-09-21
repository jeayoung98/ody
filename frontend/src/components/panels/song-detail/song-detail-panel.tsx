"use client";

import { useEffect, useRef } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import { useFeatures } from "@/hooks/use-features";
import { PLAYBACK_BLOCKED } from "@/constants";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { usePlayability } from "@/hooks/queries/use-video-id-query";
import { usePanelBack } from "@/hooks/use-panel-back";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import SongActions from "./song-actions";
import SongCoverBackdrop from "./song-cover-backdrop";
import SongDetailSkeleton from "./song-detail-skeleton";
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
 *
 * 제목·행동 줄 아래는 **한 장으로 이어 붙인다** (S15P21A405-477): 주변곡 → 관련 플리 → 소리.
 * 탭이었다가 걷어낸 이유는 아래 렌더 부분에 적어 뒀다.
 */
export default function SongDetailPanel() {
  const musicId = usePanelStore((s) => s.musicId);
  const features = useFeatures();
  const { data, isPending, isError } = useMusicDetailQuery(musicId);
  // 이 겹에 없는 곡이면 고스트별로 띄운 상태다 — 이동 안내를 함께 보여준다 (MAP-12)
  const elsewhere = useMapStore((s) => s.selectedMusicId === musicId && s.ghostMusicId === musicId);
  const bodyRef = useRef<HTMLDivElement>(null);
  /**
   * 돌아갈 자리가 있으면 **패널 제목이 그 이름이 된다** (S15P21A405-384) — `곡 상세` 는 어느
   * 곡을 보든 같은 말이라 자리를 내줘도 잃을 게 없고, 화살표 옆에 이름이 서야 어디로 가는지
   * 눌러 보기 전에 안다.
   */
  const back = usePanelBack();
  /**
   * 찾아봤는데 음원이 없는 곡 (S15P21A405-384).
   *
   * **아래를 통째로 접는다.** 못 듣는 곡을 두고 "이런 소리예요" 를 보여 주거나 "가장 비슷한
   * 곡" 을 들려줄 수는 없다 — 비교할 소리가 없으니 설문의 근거도 안 생긴다. 남는 것은 제목·칩과
   * **왜 안 되는지, 무엇을 해 주면 되는지**(신고) 한 줄이다.
   */
  const { blocked } = usePlayability(musicId);
  const dead = blocked === PLAYBACK_BLOCKED.noVideo;

  // 유저 테스트 동안 플리를 감췄다 (S15P21A405-333) — 못 여는 플리 목록을 보여 주지 않는다
  const hasPlaylists = features.playlist;

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
      title={back?.label ?? "곡 상세"}
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
      {/*
        커버를 드러내는 창.

        **시트를 내리면 이 창이 줄어든다** (S15P21A405-417, `globals.css`). 폰에서 접으면
        화면에 걸리는 건 머리글과 이 창뿐이라 **무슨 곡인지가 안 보였다** — 창을 줄이면
        제목·가수가 그 자리로 따라 올라온다. 인라인 `height` 라 CSS 쪽은 `!important` 로 덮는다.
      */}
      <div aria-hidden data-cover-window style={{ height: COVER_WINDOW }} />
      <div className="relative flex flex-col gap-3.5 px-[15px] pt-3.5 pb-[18px]">
        {/* 시트 바닥 — 윗머리는 커버가 비치도록 투명에서 시작한다 */}
        <div aria-hidden style={{ height: SHEET_FADE }} className="pointer-events-none absolute inset-x-0 top-0 -z-10 bg-gradient-to-b from-transparent to-void-3" />
        <div aria-hidden style={{ top: SHEET_FADE }} className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 bg-void-3" />

        {isPending && <SongDetailSkeleton />}
        {isError && <ErrorMessage />}
        {data && (
          <>
            <SongHeader music={data} />
            {elsewhere && <SongElsewhereNote musicId={data.id} />}
            <SongActions music={data} />
            {/*
              정보 표(발매 국가·작곡가·곡 길이·장르·누적 재생 …)는 걷어냈다 (S15P21A405-384).
              올 값은 넷뿐이었고 그중 셋은 제목 아래 칩이 이미 말한다. BPM 은 칩에도 없어
              이 화면에서 사라진 유일한 값이다.
            */}
            {/*
              **탭을 걷고 한 장으로 폈다** (S15P21A405-477). 유저 테스트 동안 플리가 꺼져 있어
              탭이 둘뿐이었는데, 두 개짜리 탭바는 한 줄을 상시로 쓰면서 절반을 클릭 뒤에 숨긴다.
              특히 `소리`(축 차트)는 **주변곡이 왜 주변곡인지 설명하는 근거**라 탭 뒤에 있으면
              대부분 한 번도 안 열어 보고 "닮았나요" 에 답하게 된다.

              순서가 곧 우선순위다: 주변곡 → 플리 → 소리. 차트는 위 다섯만 펴 두고 접혀 있어서
              (`song-pc-list`) 한 장으로 합쳐도 늘어나는 높이가 크지 않다.

              섹션이 셋을 넘거나 한 곡에서 주변곡 ↔ 소리를 오가는 사용이 실제로 보이면 그때
              탭으로 돌린다 — 이 구조에서 되돌리기는 쉽다.

              **담긴 플리가 없으면 그 칸은 통째로 빠진다** — 탭이던 시절에는 빈 탭을 눌러 본
              사람에게 "여기서 만들라" 고 권할 자리가 있었지만, 한 장이 된 지금은 그 권유가
              주변곡과 소리 사이를 늘 갈라놓는다. 새 플리 만들기는 제목 줄의 플리 버튼
              (`add-to-playlist-menu`) 에 그대로 있다.
            */}
            {!dead && (
              // 여정 버튼 줄과는 한 칸 더 띄운다 — 위는 "이 곡으로 할 일", 아래는 "이 곡에 관한 것"이다.
              // 섹션 사이는 구분선 앞뒤로 20px 씩 — 탭을 걷은 뒤로는 이 빈칸이 탭바 노릇을 한다
              <div className="flex flex-col gap-5 pt-2">
                <SongNearbyList items={data.nearby} centerMusicId={data.id} />
                {hasPlaylists && data.relatedPlaylists.length > 0 && (
                  <>
                    <Divider />
                    <SongRelatedPlaylists items={data.relatedPlaylists} />
                  </>
                )}
                <Divider />
                <SongPcList items={data.principalComponents} />
              </div>
            )}
          </>
        )}
      </div>
    </Box>
  );
}
