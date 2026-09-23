"use client";

import { useEffect, useRef } from "react";
import { drawConstellation } from "@/lib/constellation-draw";
import type { ContestTrack } from "@/types";

interface ConstellationThumbProps {
  tracks: ContestTrack[];
  closed: boolean;
  /** 한 변(px). 정사각형이다 */
  size: number;
  /** 순위 제외 등 — 회색조 */
  dim?: boolean;
  className?: string;
}

/** 출품작 썸네일 — 갤러리 카드·순위 줄이 같은 그림을 쓴다 */
export default function ConstellationThumb({ tracks, closed, size, dim = false, className = "" }: ConstellationThumbProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawConstellation(ctx, tracks, closed, size, size, { dim, starR: size < 60 ? 1.6 : 2.6, lineWidth: size < 60 ? 1 : 1.3 });
  }, [tracks, closed, size, dim]);
  return <canvas ref={ref} aria-hidden style={{ width: size, height: size }} className={`shrink-0 rounded-box-xs bg-void ${className}`} />;
}
