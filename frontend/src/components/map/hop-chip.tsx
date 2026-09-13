"use client";

import { useEffect, useRef } from "react";
import { RadarIcon } from "@/components/common/icons";
import { HOP_CHIP } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";
import type { MapEngine } from "./engine/map-engine";

interface HopChipProps {
  engine: MapEngine;
}

/**
 * 주변 탐색 중 **중심이 아닌 이웃을 선택하면 그 별 곁에 붙는 "여기서 둘러보기" 칩** (S15P21A405-288).
 * 이웃을 누르는 것만으로는 건너가지 않으므로(선택·재생만 — 정찰), 건너가는 길(항해)이 **시선이 있는 자리**에
 * 보여야 한다. 하단 버튼에 글자만 바꿔 두면 눈에 안 띄고, 한 버튼이 "닫기"와 "건너가기" 두 뜻을 갖게 된다.
 *
 * 자리는 호버 카드처럼 rAF 에서 `style.transform` 만 직접 쓴다 — 고리가 밀리거나 드래그돼도 별을 따라간다.
 * **고리 중심에서 바깥쪽** 옆에 붙인다 — 안쪽에 붙이면 중심 별이나 다른 이웃을 덮는다. 남은 화면에 걸리면
 * 뒤집지 않고 안으로 밀어 넣고, 그래도 별을 덮게 되면 별 위로 올린다. 별 아래는 제목·순위 라벨 자리라 피한다
 */
export default function HopChip({ engine }: HopChipProps) {
  const viewMode = useMapStore((s) => s.viewMode);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const ref = useRef<HTMLButtonElement | null>(null);

  const musicId = viewMode === "nearby" && selectedMusicId != null && selectedMusicId !== nearbyCenterMusicId ? selectedMusicId : null;
  const song = musicId != null ? engine.songs.find((s) => s.musicId === musicId) : undefined;

  useEffect(() => {
    if (musicId == null) return;
    let raf = 0;
    const follow = () => {
      raf = requestAnimationFrame(follow);
      const el = ref.current;
      if (!el) return;
      // 밀려나는(옅어지는) 고리의 곡은 누를 수 없으니 칩도 숨긴다
      const gate = engine.clickableOverlayIds();
      const at = gate?.has(musicId) ? engine.probePos(musicId) : null;
      if (!at) {
        el.style.visibility = "hidden";
        return;
      }
      const f = engine.freeRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const m = HOP_CHIP.margin;
      const center = engine.nearby ? engine.probePos(engine.nearby.centerId) : null;
      const right = !center || at.x >= center.x;
      const x0 = f.x0 + m;
      const x1 = f.x1 - m - w;
      let x = Math.min(x1, Math.max(x0, right ? at.x + HOP_CHIP.gap : at.x - HOP_CHIP.gap - w));
      let y = at.y - h / 2;
      // 밀어 넣다 별을 덮게 되면(별 좌우 gap 안으로 들어오면) 별 위로 올린다
      const covers = x < at.x + HOP_CHIP.gap && x + w > at.x - HOP_CHIP.gap;
      if (covers) {
        x = Math.min(x1, Math.max(x0, at.x - w / 2));
        y = at.y - HOP_CHIP.gap - h;
      }
      y = Math.min(Math.max(y, f.y0 + m), f.y1 - h - m);
      el.style.visibility = "visible";
      el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [engine, musicId]);

  if (musicId == null || !song) return null;

  return (
    // 카드 위에서 누른 것은 지도에 넘기지 않는다 — 안 그러면 지도 클릭이 그 별을 다시 눌러 재생한다.
    // 선택이 바뀔 때마다 key 로 다시 그려서 등장 애니메이션이 매번 재생된다
    <button
      key={musicId}
      ref={ref}
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        enterNearby(musicId);
      }}
      aria-label={`${song.title} 주변 둘러보기`}
      title="여기서 둘러보기"
      style={{ visibility: "hidden" }}
      // 글자 없이 아이콘만 — 별 곁에 붙는 것이라 작아야 고리를 어지럽히지 않는다. 뜻은 툴팁으로
      className="glass animate-tin absolute top-0 left-0 z-[25] grid h-7 w-7 cursor-pointer place-items-center rounded-full! border-teal/40! text-teal shadow-glow-teal will-change-transform transition-colors hover:bg-glass-3 hover:text-white"
    >
      <RadarIcon size={13} />
    </button>
  );
}
