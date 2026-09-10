"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/use-player-store";
import type { MapEngine } from "./engine/map-engine";
import { drawMap } from "./render/draw-map";

interface MapCanvasProps {
  engine: MapEngine;
  width: number;
  height: number;
}

/** 지도 렌더러 (Canvas 2D). rAF 루프에서 엔진을 한 스텝 진행시키고 그린다 */
export default function MapCanvas({ engine, width, height }: MapCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    engine.setSize(width, height);
  }, [engine, width, height]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d", { alpha: false });
    if (!g) return;
    let raf = 0;
    const frame = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(engine.W));
      const H = Math.max(1, Math.round(engine.H));
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.frame(now);
      drawMap(g, engine, usePlayerStore.getState().currentMusicId);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // replaced 요소라 inset:0 만으로는 늘어나지 않는다 — width/height 100% 명시
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}
