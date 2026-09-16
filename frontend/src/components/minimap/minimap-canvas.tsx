"use client";

import { useEffect, useRef } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { LAYER_NAMES } from "@/constants";
import { genreRgb, rgba } from "@/constants/design-tokens";
import { useMapStore } from "@/stores/use-map-store";

const MSPAN = 6; // 미니맵이 담는 월드 폭 (z-score 단위, 중심 ±3)

/** #miniWrap — 이 레이어 상주 곡을 점으로, 뷰포트 사각형과 내 위치를 얹는다. 클릭하면 그 지점으로 이동 */
export default function MinimapCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const layer = useMapStore((s) => s.layer);
  const residentCount = useMapStore((s) => s.residentCount);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 120) return; // 8fps 면 충분
      last = now;
      const e = getMapEngine();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth || 1;
      const h = cv.clientHeight || 1;
      if (cv.width !== w * dpr || cv.height !== h * dpr) {
        cv.width = w * dpr;
        cv.height = h * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#050810";
      g.fillRect(0, 0, w, h);
      if (!e || !e.N) return;
      // 상주 집합의 중심을 미니맵 중앙에
      const dx = e.layer * 2;
      const dy = e.layer * 2 + 1;
      let mx = 0;
      let my = 0;
      let n = 0;
      for (let i = 0; i < e.N; i++) {
        if (!e.subset[i]) continue;
        mx += e.songs[i].pc[dx];
        my += e.songs[i].pc[dy];
        n++;
      }
      mx /= n || 1;
      my /= n || 1;
      const X = (x: number) => ((x - mx) / MSPAN + 0.5) * w;
      const Y = (y: number) => (0.5 - (y - my) / MSPAN) * h;
      g.globalCompositeOperation = "lighter";
      const step = e.N > 3000 ? 2 : 1;
      for (let i = 0; i < e.N; i += step) {
        if (!e.subset[i] || e.alpha[i] < 0.5) continue;
        const s = e.songs[i];
        g.globalAlpha = 0.12 + Math.min(1, Math.log10(s.weight) / 7) * 0.3;
        g.fillStyle = rgba(genreRgb(s.genreId), 1);
        g.fillRect(X(s.pc[dx]), Y(s.pc[dy]), 1.1, 1.1);
      }
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      // 뷰포트
      const halfW = e.W / 2 / e.cam.s;
      const halfH = e.H / 2 / e.cam.s;
      let x0 = X(e.cam.cx - halfW);
      let y0 = Y(e.cam.cy + halfH);
      let bw = X(e.cam.cx + halfW) - x0;
      let bh = Y(e.cam.cy - halfH) - y0;
      const MINB = 15;
      const tiny = bw < MINB || bh < MINB;
      if (bw < MINB) {
        x0 = x0 + bw / 2 - MINB / 2;
        bw = MINB;
      }
      if (bh < MINB) {
        y0 = y0 + bh / 2 - MINB / 2;
        bh = MINB;
      }
      g.fillStyle = "rgba(79,227,206,.12)";
      g.fillRect(x0, y0, bw, bh);
      g.strokeStyle = "rgba(79,227,206,.95)";
      g.lineWidth = tiny ? 1.4 : 1;
      g.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(bw), Math.round(bh));
      if (tiny) {
        g.strokeStyle = "rgba(79,227,206,.4)";
        g.beginPath();
        g.moveTo(x0 + bw / 2, 0);
        g.lineTo(x0 + bw / 2, h);
        g.moveTo(0, y0 + bh / 2);
        g.lineTo(w, y0 + bh / 2);
        g.stroke();
      }
      // 내 좌표 · 화면에 잡힌 사용자
      g.fillStyle = "#4fe3ce";
      g.beginPath();
      g.arc(X(e.me.x), Y(e.me.y), 2, 0, 6.284);
      g.fill();
      g.fillStyle = "rgba(233,241,255,.55)";
      for (const fr of e.visFriends) {
        const wpos = e.screenToWorld(fr.px, fr.py);
        g.beginPath();
        g.arc(X(wpos.x), Y(wpos.y), 1.3, 0, 6.284);
        g.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="relative h-24 cursor-crosshair overflow-hidden rounded-[13px] border border-white/[.075] bg-[#050810]"
      onPointerDown={(e) => {
        const eng = getMapEngine();
        if (!eng || !eng.N) return;
        const r = e.currentTarget.getBoundingClientRect();
        const dx = eng.layer * 2;
        const dy = eng.layer * 2 + 1;
        let mx = 0;
        let my = 0;
        let n = 0;
        for (let i = 0; i < eng.N; i++) {
          if (!eng.subset[i]) continue;
          mx += eng.songs[i].pc[dx];
          my += eng.songs[i].pc[dy];
          n++;
        }
        mx /= n || 1;
        my /= n || 1;
        eng.setCameraCenter(mx + ((e.clientX - r.left) / r.width - 0.5) * MSPAN, my - ((e.clientY - r.top) / r.height - 0.5) * MSPAN);
      }}
    >
      <canvas ref={ref} className="block h-full w-full" />
      <span className="lbl pointer-events-none absolute bottom-1.5 left-2">
        {LAYER_NAMES[layer]} · {residentCount.toLocaleString()}곡
      </span>
    </div>
  );
}
