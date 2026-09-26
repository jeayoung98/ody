/**
 * 미니맵 좌표 변환 (S15P21A405-685). 월드 상자를 캔버스 안에 **가로세로 같은 배율**로 담는다 —
 * 축마다 따로 늘리면 지도와 모양이 달라진다. 그리기와 클릭이 같은 변환을 써야 누른 자리로 간다.
 */
export interface MinimapFit {
  /** 월드 1 = 미니맵 몇 px */
  s: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function minimapFit(box: { x0: number; x1: number; y0: number; y1: number }, w: number, h: number, pad: number): MinimapFit {
  const bw = Math.max(box.x1 - box.x0, 1e-6);
  const bh = Math.max(box.y1 - box.y0, 1e-6);
  const s = Math.max(1e-6, Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh));
  return { s, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, w, h };
}

/** 월드 → 미니맵 px (y 는 위가 양수인 월드를 아래가 양수인 화면으로 뒤집는다) */
export function toMini(f: MinimapFit, x: number, y: number): { x: number; y: number } {
  return { x: f.w / 2 + (x - f.cx) * f.s, y: f.h / 2 - (y - f.cy) * f.s };
}

/** 미니맵 px → 월드 */
export function fromMini(f: MinimapFit, px: number, py: number): { x: number; y: number } {
  return { x: f.cx + (px - f.w / 2) / f.s, y: f.cy - (py - f.h / 2) / f.s };
}
