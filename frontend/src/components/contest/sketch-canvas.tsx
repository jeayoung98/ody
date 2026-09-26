"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { SKETCH_HIT_PX } from "@/constants";
import { FONTS, PALETTE } from "@/constants/design-tokens";
import { constellationLayout, drawConstellation } from "@/lib/constellation-draw";
import type { ContestTrack, SketchPoint } from "@/types";

interface SketchCanvasProps {
  points: SketchPoint[];
  closed: boolean;
  /** 매칭 결과. 있으면 찾은 별을 또렷하게, 그린 점은 옅게 겹쳐 보인다 */
  result: ContestTrack[] | null;
  onAdd: (p: SketchPoint) => void;
  onRemove: (index: number) => void;
  /** 곡 목록에서 가리키고 있는 순번(0부터). 그 별에 고리를 두른다 (S15P21A405-693) */
  highlight?: number | null;
}

/** 결과 별자리를 그리는 여백 비율 — 번호를 얹을 때도 같은 값을 써야 별 위에 선다 */
const RESULT_PAD = 0.12;

/** 배경에 뿌려 두는 장식 별 — 빈 캔버스가 "그리는 곳" 으로 읽히게. 좌표는 고정 */
const BACKDROP: { x: number; y: number; r: number }[] = Array.from({ length: 70 }, (_, i) => {
  const a = i * 2.399963; // 황금각 — 고르게 흩어진다
  const rr = Math.sqrt((i + 0.5) / 70) * 0.5;
  return { x: 0.5 + Math.cos(a) * rr, y: 0.5 + Math.sin(a) * rr, r: 0.6 + ((i * 7919) % 10) / 12 };
});

/**
 * 점을 순서대로 찍는 캔버스 (S15P21A405-602 · 598).
 * 빈 곳을 누르면 점이 붙고, 찍힌 점을 다시 누르면 빠진다. 정사각형이고 폭은 부모를 따른다.
 * 좌표는 0~1 로만 다룬다 — 화면 크기와 무관하게 서버에 같은 모양이 간다.
 */
export default function SketchCanvas({ points, closed, result, onAdd, onRemove, highlight = null }: SketchCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ro = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = "rgba(201,211,255,.28)";
    for (const b of BACKDROP) {
      ctx.beginPath();
      ctx.arc(b.x * size, b.y * size, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const P = points.map((p) => [p.x * size, p.y * size] as const);
    const faint = result != null;
    if (P.length) {
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = faint ? "rgba(92,157,255,.18)" : "rgba(92,157,255,.7)";
      ctx.beginPath();
      P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (closed && P.length > 2) ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = faint ? "rgba(233,241,255,.25)" : PALETTE.ink;
      for (const [x, y] of P) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!faint) {
        ctx.strokeStyle = PALETTE.teal;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(P[0][0], P[0][1], 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (result) drawConstellation(ctx, result, closed, size, size, { starR: 3.2, lineWidth: 1.5, pad: RESULT_PAD });

    /**
     * **순번을 별 옆에 적는다** (S15P21A405-693). 오른쪽 곡 목록의 번호와 같다 — 점 하나가 곡 하나라는 것이
     * 번호로 이어진다. 결과가 있으면 찾은 별에, 없으면 그린 점에 붙인다.
     */
    const at = result ? constellationLayout(result, size, size, RESULT_PAD) : P;
    ctx.font = `600 10.5px ${FONTS.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    at.forEach(([x, y], i) => {
      const on = highlight === i;
      ctx.fillStyle = on ? PALETTE.teal : "rgba(201,211,255,.62)";
      ctx.fillText(String(i + 1), x + 6, y - 7);
      if (on) {
        ctx.strokeStyle = PALETTE.teal;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }, [points, closed, result, size, highlight]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const hitR = SKETCH_HIT_PX / r.width;
      const hit = points.findIndex((p) => Math.hypot(p.x - x, p.y - y) <= hitR);
      if (hit >= 0) onRemove(hit);
      else onAdd({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    },
    [points, onAdd, onRemove],
  );

  return (
    <canvas
      ref={ref}
      onClick={handleClick}
      aria-label="별자리 그리기 캔버스"
      className="aspect-square w-full cursor-crosshair rounded-box-sm border border-line bg-[radial-gradient(ellipse_at_50%_45%,rgb(22_28_52)_0%,var(--color-void)_72%)]"
    />
  );
}
