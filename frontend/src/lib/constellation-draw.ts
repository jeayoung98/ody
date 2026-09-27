import { PALETTE } from "@/constants/design-tokens";
import type { ContestTrack } from "@/types";

interface DrawOptions {
  /** 순위 제외·비활성 — 채도를 뺀다 */
  dim?: boolean;
  /** 별 반지름(px) */
  starR?: number;
  lineWidth?: number;
  /** 가장자리 여백 비율 (0~0.5) */
  pad?: number;
}

/**
 * 배치 좌표(-1~1, y 위가 양수)의 별자리를 캔버스에 그린다 (S15P21A405-602).
 * 썸네일·순위 미니·스케치 결과 미리보기가 **같은 그림**을 쓴다 — 갤러리에서 본 모양과
 * 내가 그린 결과가 다르게 생기면 안 된다.
 *
 * 색은 지도 별자리 선과 같은 계열이다 (`MAP_COLORS.routeStops` — 청록·파랑·보라).
 */
/**
 * 배치 좌표 → 캔버스 좌표. {@link drawConstellation} 과 **같은 자리**다 — 그림 위에 번호를 얹는 쪽(스케치 캔버스)이
 * 따로 계산하면 번호가 별에서 어긋난다 (S15P21A405-693).
 */
export function constellationLayout(tracks: readonly ContestTrack[], w: number, h: number, pad = 0.14): (readonly [number, number])[] {
  if (!tracks.length) return [];
  const xs = tracks.map((t) => t.x);
  const ys = tracks.map((t) => t.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const k = (Math.min(w, h) * (1 - pad * 2)) / span;
  return tracks.map((t) => [w / 2 + (t.x - cx) * k, h / 2 - (t.y - cy) * k] as const);
}

export function drawConstellation(ctx: CanvasRenderingContext2D, tracks: ContestTrack[], closed: boolean, w: number, h: number, opt: DrawOptions = {}) {
  const { dim = false, starR = 2.6, lineWidth = 1.3, pad = 0.14 } = opt;
  if (!tracks.length) return;
  const P = constellationLayout(tracks, w, h, pad);

  const line = dim ? "rgba(88,106,139,.6)" : "rgba(92,157,255,.7)";
  const star = dim ? PALETTE.ink3 : PALETTE.ink;
  const glow = dim ? "transparent" : "rgba(79,227,206,.9)";

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = line;
  ctx.lineJoin = "round";
  ctx.beginPath();
  P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (closed && P.length > 2) ctx.closePath();
  ctx.stroke();

  ctx.shadowColor = glow;
  ctx.shadowBlur = dim ? 0 : 6;
  ctx.fillStyle = star;
  for (const [x, y] of P) {
    ctx.beginPath();
    ctx.arc(x, y, starR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // 첫 별에 고리 — 잇는 순서의 출발점
  ctx.strokeStyle = dim ? PALETTE.ink4 : PALETTE.teal;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(P[0][0], P[0][1], starR + 3.5, 0, Math.PI * 2);
  ctx.stroke();
}
