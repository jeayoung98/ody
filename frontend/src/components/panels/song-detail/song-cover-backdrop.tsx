"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { coverFor } from "@/components/map/render/sprites";
import { NO_GENRE_ID } from "@/constants";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";

/** 커버가 마지막으로 사라지는 구간(px). 남은 커버가 이만큼일 때부터 패널색으로 덮기 시작한다 */
const FADE = 72;

/**
 * 배경 커버를 굽는 크기(px). 패널 폭이 376 이고 고해상도 화면에서 두 배로 그려지므로 그 언저리다.
 * Cover Art Archive 원본이 500px 이라 그보다 키워 봐야 소용없다.
 */
const BACKDROP_PX = 512;

interface SongCoverBackdropProps {
  musicId: number;
  /** 앞의 시트가 얹혀 있는 스크롤 상자 — 얼마나 올라왔는지 여기서 읽는다 */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** 시트가 맨 아래에 있을 때 헤더 밑으로 드러나는 커버 높이(px) */
  reveal: number;
}

/**
 * 곡 상세 패널 배경 — 앨범 커버 (SONG-02, S15P21A405-384).
 *
 * 패널 **최상단부터** 깔린다. 헤더('곡 상세' · 신고 · 닫기) 뒤로도 지나가고, 커버 원본이
 * 정사각(104×104)이므로 **정사각형**으로 그린다. 패널 폭을 좌우로 꽉 채운다 — 예전에는
 * 오른쪽에 스크롤바 자리 8px 을 비웠지만, 막대를 없앤 뒤로는 그 틈이 커버 옆에 빈 띠로만
 * 보였다 (S15P21A405-477).
 *
 * 이 레이어는 **스크롤을 따라가지 않는다.** 앞의 내용 시트(`song-detail-panel`)가 위로
 * 올라오면서 커버를 덮어 점점 가린다 — 커버 자체는 제자리에 고정된 그림이다.
 *
 * 다 올리면 **헤더 뒤까지 패널색으로 덮는다.** 시트가 헤더 밑까지 닿으면 커버는 헤더 뒤에만
 * 남는데, 그 조각만 남겨 두면 위쪽에 커버 띠가 걸린 채로 끝난다. 남은 높이가 `FADE` 아래로
 * 내려가는 동안 덮개를 서서히 올려 패널 전체가 한 색이 되게 한다.
 *
 * 층은 아래에서 위로 넷이다.
 * 1. 커버 — 104px 원본을 세 배 넘게 늘리므로 아주 옅은 블러로 계단만 지운다
 * 2. 브랜드 그라데이션 — `grad-bg` 를 엷게. "우리 색" 이 스미는 층
 * 3. 헤더 자리 어둠 — 위쪽만. 커버가 밝은 곡에서도 제목·버튼이 읽히게 한다
 * 4. 덮개 — 다 올렸을 때 커버를 지우는 패널색 (스크롤에 따라 투명도가 변한다)
 *
 * **진짜 앨범 커버가 있으면 그걸 깐다** (S15P21A405-518). 백엔드가 주는 `albumMbid` 로 Cover
 * Art Archive 에서 받는다. 없으면 지도가 쓰는 **절차적 커버**로 떨어진다 — 지도 것을 그대로
 * 써야 한다. 커버 색이 별 색에서 나오므로(`sprites.ts`) 여기서 따로 그리면 같은 곡이 지도와
 * 패널에서 다른 그림으로 보인다.
 *
 * **상세 응답을 기다리지 않는다.** 절차적 커버는 `musicId` 하나로 나오므로 패널이 열리는 즉시
 * 깔리고, `albumMbid` 가 도착하면 그때 진짜 그림으로 바뀐다. 기다렸다 그리면 패널을 열 때마다
 * 배경이 한 박자 비고 그 사이 헤더 글자가 맨 배경 위에 떠서 읽기 나빠진다.
 *
 * **크게 굽는다** (`BACKDROP_PX`). 예전에는 104px 을 세 배 넘게 늘려서 뭉갰고, 그걸 감추려고
 * 블러를 걸어 뒀었다.
 */
export default function SongCoverBackdrop({ musicId, scrollerRef, reveal }: SongCoverBackdropProps) {
  const coverRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  /**
   * **지도가 이미 들고 있으면 그 값을 쓴다** (S15P21A405-527). 별을 누른 순간 상주 집합에
   * `albumMbid` 가 있으므로, 상세 응답을 기다리면 이미 받아 둔 그림을 두고 화면만 비운다.
   * 상세 쿼리는 지도에 없는 곡(고스트·검색 결과)의 폴백이다 — 패널이 어차피 부르는 쿼리라
   * 요청이 새로 나가지도 않는다.
   */
  const fromMap = getMapEngine()?.pointOf(musicId)?.albumMbid ?? null;
  const fromDetail = useMusicDetailQuery(musicId).data?.albumMbid ?? null;
  const albumMbid = fromMap ?? fromDetail;

  /**
   * 캔버스는 브라우저에만 있다. 상태로 들고 있으면 서버 렌더와 값이 달라 하이드레이션이 깨지고,
   * effect 안 setState 는 lint 가 막는다. 그래서 **DOM 에 직접 칠한다.**
   *
   * `genreId` 는 지금 쓰이지 않는다 — `starColorIdx` 가 실데이터에 장르가 거의 없어서 `musicId`
   * 해시로 색을 뽑는다 (`star-look.ts` 의 `STAR_LOOK.randomColor`). 그 스위치가 내려가면
   * 여기에도 진짜 `genreId` 를 넘겨야 지도와 색이 맞는다.
   */
  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    let raf = 0;
    const paint = () => {
      const canvas = coverFor(
        { musicId, genreId: NO_GENRE_ID, pc: [], weight: 1, title: "", artist: null, youtubeUrl: null, albumMbid, playable: true },
        BACKDROP_PX,
      );
      el.style.backgroundImage = `url(${canvas.toDataURL()})`;
    };
    paint();
    /**
     * 진짜 커버는 **받은 뒤에** 캔버스가 된다. 지도는 rAF 로 계속 다시 그려서 저절로 바뀌지만
     * 여기는 한 번 칠하고 끝이라, 도착했는지 잠깐 되물어 본다. 이미 있으면 첫 칠에서 끝난다.
     */
    let tries = 0;
    const poll = () => {
      raf = 0;
      if (!albumMbid || tries++ > 40) return;
      paint();
      raf = window.setTimeout(poll, 150) as unknown as number;
    };
    raf = window.setTimeout(poll, 150) as unknown as number;
    return () => clearTimeout(raf);
  }, [musicId, albumMbid]);

  /** 덮개 투명도도 같은 이유로 DOM 에 직접 쓴다 — 스크롤마다 리렌더할 일이 아니다 */
  useEffect(() => {
    const scroller = scrollerRef.current;
    const plate = plateRef.current;
    if (!scroller || !plate) return;

    let raf = 0;
    const paint = () => {
      raf = 0;
      const left = reveal - scroller.scrollTop; // 헤더 밑에 아직 남은 커버 높이
      plate.style.opacity = String(Math.min(1, Math.max(0, 1 - left / FADE)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    paint();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [scrollerRef, reveal, musicId]);

  return (
    /*
      아래끝을 마스크로 흐린다 — 정사각형이 그대로 끝나면 시트가 덜 덮은 자리에서 밑변이
      가로선으로 보인다 (S15P21A405-384). 시트 윗머리 그라데이션과 양쪽에서 만나 녹는다.
    */
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 aspect-square [-webkit-mask-image:linear-gradient(to_bottom,#000_62%,transparent)] [mask-image:linear-gradient(to_bottom,#000_62%,transparent)]"
    >
      {/* 1. 커버 */}
      <div ref={coverRef} className="absolute inset-0 scale-[1.02] bg-cover bg-center" />
      {/* 2. 우리 색이 스민다 */}
      <div className="grad-bg absolute inset-0 opacity-40 mix-blend-soft-light" />
      {/* 3. 헤더 글자 자리 */}
      <div className="absolute inset-x-0 top-0 h-[72px] bg-gradient-to-b from-void/80 via-void/40 via-55% to-transparent" />
      {/* 4. 덮개 */}
      <div ref={plateRef} className="absolute inset-0 bg-void-3 opacity-0" />
    </div>
  );
}
