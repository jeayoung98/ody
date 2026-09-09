"use client";

import { brightConstellationIds, ghostConstellationIds, useMapStore } from "@/stores/use-map-store";

/**
 * 별자리 오버레이 칩 (PATH-01). 별자리가 있을 때만 보인다.
 * 보기/숨기기 토글 · 화면에 맞추기 · 끄기(✕). 뷰 모드·따라가기와 독립이라 서로 충돌하지 않는다.
 */
export default function ConstellationChip() {
  const ids = useMapStore(brightConstellationIds);
  const ghostIds = useMapStore(ghostConstellationIds);
  const visible = useMapStore((s) => s.constellationVisible);
  const toggle = useMapStore((s) => s.toggleConstellationVisible);
  const fit = useMapStore((s) => s.fitConstellation);
  const clearConstellation = useMapStore((s) => s.clearConstellation);
  const clearPreview = useMapStore((s) => s.clearPreview);
  const previewing = ghostIds.length >= 2;
  if (ids.length < 2) return null;

  // 미리보기 중이면 ✕ 는 미리보기만 걷어내고, 재생 중이던 별자리가 다시 또렷해진다
  const clear = previewing ? clearPreview : clearConstellation;

  return (
    <span
      className={`glass inline-flex items-center gap-1.5 rounded-pill! py-[5px] pr-1.5 pl-2.5 text-[11.5px] transition-colors ${
        visible ? "border-violet/45 text-ink shadow-glow-violet" : "text-ink-3"
      }`}
    >
      <span className={`h-1 w-1 rounded-pill ${visible ? "bg-violet shadow-[0_0_8px_#a67cff]" : "bg-ink-4"}`} />
      {previewing ? "미리보기" : "별자리"} <span className="num text-ink-3">{ids.length}곡</span>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={visible}
        title={visible ? "별자리 숨기기" : "별자리 보기"}
        className="ml-1 rounded-pill border border-line px-1.5 py-px text-[10px] text-ink-2 hover:border-line-2 hover:text-ink"
      >
        {visible ? "숨기기" : "보기"}
      </button>
      {visible && (
        <button type="button" onClick={fit} title="화면에 맞추기" className="rounded-pill border border-line px-1.5 py-px text-[10px] text-ink-2 hover:border-line-2 hover:text-ink">
          맞추기
        </button>
      )}
      <button type="button" onClick={clear} aria-label="별자리 끄기" title="별자리 끄기" className="ml-0.5 text-ink-3 hover:text-ink">
        ✕
      </button>
    </span>
  );
}
