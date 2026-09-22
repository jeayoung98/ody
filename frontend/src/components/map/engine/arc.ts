/**
 * 두 자리를 잇는 **곡선 비행** (S15P21A405-553).
 *
 * 지도에서 무언가가 자리를 옮길 때 직선으로 미끄러지면 미끄러지는 것으로 보이고, 살짝 휘면
 * 날아가는 것으로 보인다. 그 차이 하나를 만드는 계산이다 — 2차 베지에 하나와, 진행 방향을
 * 접선에서 뽑는 것.
 *
 * 엔진 안에 같은 식이 두 번 적혀 있었다 (내 비행·인솔자 우주선). 사람 표식까지 세 번째로
 * 베끼는 대신 여기로 모은다 — 휘는 정도를 손볼 일이 생기면 한 군데만 고친다.
 */

export interface Arc {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** 제어점. 두 끝의 중점에서 **수직으로** 밀어낸 자리라 곡선이 한쪽으로 휜다 */
  cx: number;
  cy: number;
  t0: number;
  dur: number;
}

export interface ArcPoint {
  x: number;
  y: number;
  /** 지금 향하는 쪽(라디안). 헬멧·우주선 기수가 이걸 본다 */
  heading: number;
  /** 0~1. 1 이면 도착이다 */
  t: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * `from` 에서 `to` 로 가는 호를 만든다.
 *
 * `bow` 는 거리 대비 휘는 정도다. **거리에 비례**하므로 짧게 움직이면 살짝, 멀리 가면 크게
 * 휜다 — 고정값으로 두면 가까운 이동이 우스꽝스럽게 꺾인다.
 *
 * `side` 로 어느 쪽으로 휠지 정한다. 안 주면 무작위 — 같은 두 점을 오갈 때 늘 같은 길로
 * 다니면 레일 위를 오가는 것처럼 보인다.
 */
export function arcBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
  now: number,
  dur: number,
  bow: number,
  side: 1 | -1 = Math.random() < 0.5 ? 1 : -1,
): Arc {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // 0 으로 나누지 않게. 제자리 이동이면 곡선도 제자리다
  const L = Math.hypot(dx, dy) || 1e-6;
  return {
    ax: from.x,
    ay: from.y,
    bx: to.x,
    by: to.y,
    cx: (from.x + to.x) / 2 - (dy / L) * L * bow * side,
    cy: (from.y + to.y) / 2 + (dx / L) * L * bow * side,
    t0: now,
    dur: Math.max(1, dur),
  };
}

/** 지금 이 순간 호 위의 자리와 방향 */
export function atArc(a: Arc, now: number): ArcPoint {
  const t = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
  const e = easeInOut(t);
  const q = 1 - e;
  const hx = 2 * q * (a.cx - a.ax) + 2 * e * (a.bx - a.cx);
  const hy = 2 * q * (a.cy - a.ay) + 2 * e * (a.by - a.cy);
  return {
    x: q * q * a.ax + 2 * q * e * a.cx + e * e * a.bx,
    y: q * q * a.ay + 2 * q * e * a.cy + e * e * a.by,
    heading: Math.atan2(hy, hx),
    t,
  };
}
