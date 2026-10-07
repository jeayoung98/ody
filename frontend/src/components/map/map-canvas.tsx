"use client";

import { useEffect, useRef } from "react";
import { MAP_COVERED } from "@/constants";
import { useMapCoverStore } from "@/stores/use-map-cover-store";
import { usePlayerStore } from "@/stores/use-player-store";
import type { MapEngine } from "./engine/map-engine";
import { drawMap, settleAppear } from "./render/draw-map";

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
    /** 덮인 동안 엔진을 마지막으로 굴린 때 */
    let stepped = 0;
    /** 덮여서 그리기를 건너뛴 프레임이 있었나 — 돌아온 첫 프레임을 알아보려고 */
    let skipped = false;
    /** 마지막으로 그린 곡 목록 — 덮여 있어도 곡이 새로 오면 한 번은 그린다 */
    let drawnSongs: MapEngine["songs"] | null = null;
    /** 덮인 동안 지도가 움직였나 */
    let moved = false;
    /** 덮여 있어도 그릴 남은 프레임 수 — 움직이던 지도가 멎으면 채운다 */
    let catchUp = 0;
    const frame = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(engine.W));
      const H = Math.max(1, Math.round(engine.H));
      // 크기를 바꾸면 캔버스가 비워진다 — 덮여 있어도 그 프레임은 그린다
      let cleared = false;
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
        cleared = true;
      }
      /**
       * **지도를 통째로 덮은 화면이 있으면 그리지 않는다** (S15P21A405-737). 폰의 탭 화면은 반투명 유리라 뒤가
       * 비치지만, 멈춘 그림과 계속 그린 그림이 6초 동안 픽셀 최대 7/255 차이라 눈으로 구별되지 않았다.
       *
       * 엔진은 띄엄띄엄 계속 굴린다 — 따라가기 중 곡이 넘어가면 지도가 탭 뒤에서 새 곡으로 옮겨 가 있어야,
       * 돌아왔을 때 미끄러져 가는 모습이 안 보인다. 곡 목록이 새로 왔거나 캔버스가 비워졌으면 덮여 있어도
       * 한 번은 그린다 — 안 그러면 유리 뒤가 빈 하늘로 남는다.
       *
       * **옮겨 가던 지도가 멎으면 두 번 그린다.** 앨범 커버는 그릴 때 고르고 그때 그림을 받기 시작하는데,
       * 미는 동안에는 새 커버를 올리지 않는다(`drawCovers`) — 그래서 멎은 뒤 한 번은 "멎었다" 를 알리고, 한 번은
       * 커버를 고른다. 이걸 안 하면 돌아온 뒤에야 새 자리의 그림을 받기 시작해, 대신 그린 무늬가 잠깐 보인다.
       */
      if (useMapCoverStore.getState().covers > 0 && !cleared && drawnSongs === engine.songs && catchUp === 0) {
        if (now - stepped >= MAP_COVERED.engineStepMs) {
          const { cx, cy, s } = engine.cam;
          engine.frame(now);
          stepped = now;
          if (engine.cam.cx !== cx || engine.cam.cy !== cy || engine.cam.s !== s) moved = true;
          else if (moved) {
            moved = false;
            catchUp = 2;
          }
        }
        skipped = true;
      } else {
        if (catchUp > 0) catchUp--;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        engine.frame(now);
        // 건너뛰다가 처음 그리는 프레임 — 그동안 안 그린 별이 0 부터 다시 밝아지지 않게 한다
        if (skipped) settleAppear(engine.time);
        skipped = false;
        drawMap(g, engine, usePlayerStore.getState().currentMusicId);
        drawnSongs = engine.songs;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // replaced 요소라 inset:0 만으로는 늘어나지 않는다 — width/height 100% 명시
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}
