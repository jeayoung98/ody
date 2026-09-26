"use client";

import { useRef } from "react";
import { useAlbumCover } from "@/hooks/use-album-cover";
import { COVER_SHADE, canvasLuma, shadeForLuma } from "@/lib/cover-shade";

/**
 * 커버를 굽는 크기(px). 바 폭이 376 이고 위에 블러가 덮이므로 이 정도면 충분하다.
 * 곡 상세(512)만큼 키우면 한 장에 1MB 라 커버 예산만 먹는다 (`cover-art.ts`).
 */
const BACKDROP_PX = 256;

/**
 * 플레이어바 배경 — 듣는 곡의 **앨범 커버**를 깔고 블러를 덮어 슬쩍 비치게 한다 (S15P21A405-428 · 704).
 *
 * 예전에는 104px 절차적 커버를 투명도 50%·블러 8px 로 깔고 진한 검정 그라데이션을 덮어서 **색만** 보였다.
 * 이제 곡 상세 배경과 같이 진짜 앨범 커버를 쓴다(`useAlbumCover`, 없으면 절차적 커버).
 *
 * 층은 아래에서 위로 셋이다.
 * 1. 커버 — 온전한 투명도로. 가장자리까지 블러가 번지도록 살짝 키운다
 * 2. 서리 — `backdrop-blur` 로 커버를 뭉개고 어둡게 덮는다. 그림은 형체만, 글자는 또렷하게.
 *    **농도는 커버 밝기를 따른다** (`cover-shade.ts`) — 흰 커버에서 회색 글자가 묻혔다
 * 3. 아래 어둠 — 글자와 버튼이 아래쪽에 몰려 있어 밝은 커버에서도 읽히게 한 번 더 누른다
 */
export default function PlayerBackdrop({ musicId }: { musicId: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  // 리렌더할 일이 아니라 DOM 에 직접 쓴다 — 커버가 칠해질 때마다(절차적 → 진짜 커버) 한 번씩
  useAlbumCover(ref, musicId, BACKDROP_PX, (canvas) => {
    const luma = canvasLuma(canvas);
    if (shadeRef.current) shadeRef.current.style.opacity = String(luma == null ? COVER_SHADE.max : shadeForLuma(luma));
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div ref={ref} className="absolute inset-0 scale-125 bg-cover bg-center" />
      <div className="absolute inset-0 backdrop-blur-md" />
      <div ref={shadeRef} className="absolute inset-0 bg-void transition-opacity duration-300" style={{ opacity: COVER_SHADE.max }} />
      <div className="absolute inset-0 bg-gradient-to-t from-void/70 via-void/25 to-transparent" />
    </div>
  );
}
