"use client";

import { useEffect, useRef } from "react";
import { coverFor } from "@/components/map/render/sprites";
import { NO_GENRE_ID } from "@/constants";
import type { MusicDetail } from "@/types";

/**
 * 곡 상세 상단 히어로 (SONG-02, S15P21A405-314).
 *
 * 커버를 배경으로 깔고 아래로 내려오면서 브랜드 그라데이션을 거쳐 패널 배경으로 녹는다.
 * 제목·아티스트·앨범은 그 녹아드는 자리에 얹는다 — 커버가 옅어진 곳이라 글자가 읽힌다.
 *
 * 층은 아래에서 위로 넷이다.
 * 1. 커버 — 확대·블러. 104px 짜리 절차적 그림이라 원본 크기로는 계단이 보인다
 * 2. 브랜드 그라데이션 — `grad-bg` 를 엷게. "우리 색" 이 스며드는 층
 * 3. 아래로 향하는 어둠 — 위는 투명, 아래는 패널 배경색. 글자 대비를 만든다
 * 4. 글자
 *
 * 패널 본문의 좌우·상단 패딩을 음수 마진으로 되돌려 **끝까지 채운다** (`Box` 의 px-[15px] pt-3.5).
 *
 * **실제 앨범 아트는 없다.** `MusicDetail.albumCoverUrl` 은 타입에만 있고 항상 null 이다
 * (ERD 에 없음 — BACKEND-NOTES E-5). 그래서 지도가 쓰는 **절차적 커버**를 그대로 가져온다.
 * 지도 것을 그대로 써야 한다 — 커버 색은 별 색에서 나오므로(`sprites.ts`) 여기서 따로 그리면
 * 같은 곡이 지도와 패널에서 다른 그림으로 보인다.
 */
export default function SongHero({ music }: { music: MusicDetail }) {
  const coverRef = useRef<HTMLDivElement>(null);

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
    const canvas = coverFor({ musicId: music.id, genreId: NO_GENRE_ID, pc: [], weight: 1, title: "", artist: null, youtubeUrl: null, playable: true });
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }, [music.id]);

  return (
    <div className="relative -mx-[15px] -mt-3.5 h-[188px] overflow-hidden">
      {/* 1. 커버 — 104px 원본을 넓게 늘리므로 아주 옅은 블러로 계단만 지운다 */}
      <div ref={coverRef} aria-hidden className="absolute inset-0 scale-110 bg-cover bg-center blur-[1px]" />
      {/* 2. 우리 색이 스민다 */}
      <div aria-hidden className="grad-bg absolute inset-0 opacity-45 mix-blend-soft-light" />
      {/* 3. 아래로 갈수록 패널 배경으로. 위쪽 60%는 커버를 살려 둔다 */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent from-35% via-void/45 via-72% to-void" />
      {/* 위쪽 헤더 경계만 아주 살짝 */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-void/45 to-transparent" />

      {/* 4. 글자 */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-[15px] pb-3">
        <h3 className="truncate font-display text-2xl leading-[1.2] font-semibold text-ink drop-shadow-[0_2px_8px_rgba(4,6,13,.85)]">
          {music.title}
        </h3>
        <p className="truncate text-sm text-ink-2 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]">{music.artist ?? "Unknown"}</p>
        {music.album && <p className="truncate text-xs text-ink-3 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]">{music.album}</p>}
      </div>
    </div>
  );
}
