"use client";

import { useEffect, useRef, type RefObject } from "react";
import { coverFor } from "@/components/map/render/sprites";
import { NO_GENRE_ID } from "@/constants";

/** 커버가 마지막으로 사라지는 구간(px). 남은 커버가 이만큼일 때부터 패널색으로 덮기 시작한다 */
const FADE = 72;

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
 * 정사각(104×104)이므로 **정사각형**으로 그린다. 오른쪽 스크롤바 자리는 비운다 —
 * 커버 위에 걸치면 옅은 스크롤바가 묻혀서 안 보인다.
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
 * **실제 앨범 아트는 없다.** `MusicDetail.albumCoverUrl` 은 타입에만 있고 항상 null 이다
 * (ERD 에 없음 — BACKEND-NOTES E-5). 그래서 지도가 쓰는 **절차적 커버**를 그대로 가져온다.
 * 지도 것을 그대로 써야 한다 — 커버 색은 별 색에서 나오므로(`sprites.ts`) 여기서 따로 그리면
 * 같은 곡이 지도와 패널에서 다른 그림으로 보인다.
 *
 * 상세 응답을 기다리지 않는다. 커버는 `musicId` 하나로 나오므로 패널이 열리는 즉시 깔린다.
 */
export default function SongCoverBackdrop({ musicId, scrollerRef, reveal }: SongCoverBackdropProps) {
  const coverRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);

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
    const canvas = coverFor({ musicId, genreId: NO_GENRE_ID, pc: [], weight: 1, title: "", artist: null, youtubeUrl: null, playable: true });
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }, [musicId]);

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
      className="pointer-events-none absolute top-0 right-2 left-0 aspect-square [-webkit-mask-image:linear-gradient(to_bottom,#000_62%,transparent)] [mask-image:linear-gradient(to_bottom,#000_62%,transparent)]"
    >
      {/* 1. 커버 */}
      <div ref={coverRef} className="absolute inset-0 scale-[1.02] bg-cover bg-center blur-[1px]" />
      {/* 2. 우리 색이 스민다 */}
      <div className="grad-bg absolute inset-0 opacity-40 mix-blend-soft-light" />
      {/* 3. 헤더 글자 자리 */}
      <div className="absolute inset-x-0 top-0 h-[72px] bg-gradient-to-b from-void/80 via-void/40 via-55% to-transparent" />
      {/* 4. 덮개 */}
      <div ref={plateRef} className="absolute inset-0 bg-void-3 opacity-0" />
    </div>
  );
}
