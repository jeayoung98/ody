"use client";

import { useEffect, useRef } from "react";
import { coverFor } from "@/components/map/render/sprites";
import { NO_GENRE_ID } from "@/constants";

/**
 * 플레이어바 배경 — 듣는 곡의 앨범 커버를 연하게 깔고 검정 그라데이션을 앞에 덮는다 (S15P21A405-428).
 *
 * 커버는 곡 상세 배경(`song-cover-backdrop.tsx`)과 **같은 절차적 커버**다 — 실제 앨범 아트는
 * 아직 없고(`albumCoverUrl` 항상 null, BACKEND-NOTES E-5), 지도 별 색에서 나온 그림을 그대로 써야
 * 같은 곡이 어디서나 같은 색으로 보인다. 캔버스는 브라우저에만 있어 DOM 에 직접 칠한다.
 *
 * 아래는 진하게, 위는 옅게 덮는다 — 글자와 버튼이 아래쪽에 몰려 있다.
 */
export default function PlayerBackdrop({ musicId }: { musicId: number | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (musicId == null) {
      el.style.backgroundImage = "";
      return;
    }
    const canvas = coverFor({ musicId, genreId: NO_GENRE_ID, pc: [], weight: 1, title: "", artist: null, youtubeUrl: null, playable: true });
    el.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }, [musicId]);

  return (
    // 폰에서는 걷는다 (S15P21A405-703) — 재생바가 반투명 유리라 뒤가 비쳐야 한다. 커버가 깔리면 도로 막힌다
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] max-tablet:hidden">
      {/* 104px 원본을 크게 늘리므로 블러로 계단을 지운다. 살짝 키워 블러 가장자리를 밖으로 밀어낸다 */}
      <div ref={ref} className="absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-[8px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/65 to-void/30" />
    </div>
  );
}
