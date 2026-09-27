/**
 * 주변 탐색 라벨이 **서로 가리지 않게** 별 자리를 민다 (S15P21A405-697).
 *
 * 고리 배치는 각도만으로 정해져서, 제목이 긴 이웃 둘이 붙으면 라벨 상자가 겹쳤다. 잘라 쓰면(말줄임) 뒷부분을 못
 * 보고, 흘려 쓰면(마퀴) 정신없다 — 그래서 글은 다 보이게 두고 **자리를 민다.** 상자끼리 `gap` 만큼 떨어질 때까지
 * 겹친 쌍을 덜 겹친 축으로 반씩 밀어낸다. 고정된 상자(가운데 곡)는 안 움직이고 상대가 다 밀린다.
 *
 * 폰은 다르다 (S15P21A405-715) — 미는 대신 {@link placeLabels} 로 앞 순위부터 빈자리에 놓고, 그래도 부딪히는 글자는
 * {@link cullLabels} 로 숨긴다.
 *
 * 순수 함수다 — 엔진이 부르고 `tests/probe-layout.test.cjs` 가 묶는다.
 */
export interface LabelBox {
  id: number;
  /** 별 자리 (고리 중심 기준 px) */
  x: number;
  y: number;
  /** 라벨 묶음 폭(px). 별을 가운데로 좌우 대칭이다 */
  w: number;
  /** 별에서 라벨 묶음 위·아래 끝까지(px, 아래가 양수) */
  top: number;
  bottom: number;
  /** 움직이지 않는다 (가운데 곡) */
  fixed?: boolean;
}

/**
 * 라벨 묶음이 들어가야 하는 사각형 (고리 중심 기준 px) — **폰에서만 준다** (S15P21A405-715).
 *
 * 미는 계산이 화면을 몰라서, 좁은 화면에서는 끝 라벨이 밖으로 밀려나거나 시트 밑에 깔렸다. 주면 밀 때마다
 * 이 안으로 되돌린다. 넓은 화면은 고리가 화면보다 한참 작아 줄 이유가 없고, 안 주면 예전과 똑같이 민다.
 */
export interface LabelBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** 상자를 사각형 안으로 되돌린다. 사각형보다 큰 쪽 축은 가운데에 둔다 — 어느 끝에 붙여도 반은 잘린다 */
function keepInside(b: LabelBox, r: LabelBounds) {
  const minX = r.x0 + b.w / 2;
  const maxX = r.x1 - b.w / 2;
  b.x = minX > maxX ? (r.x0 + r.x1) / 2 : Math.min(maxX, Math.max(minX, b.x));
  const minY = r.y0 - b.top;
  const maxY = r.y1 - b.bottom;
  b.y = minY > maxY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, b.y));
}

/** 겹친 쌍이 없어질 때까지(또는 `maxIter` 번) 민 뒤의 별 자리. `bounds` 를 주면 그 안에 가둔다 */
export function separateLabels(boxes: readonly LabelBox[], gap: number, maxIter = 160, bounds?: LabelBounds): Map<number, { x: number; y: number }> {
  const p = boxes.map((b) => ({ ...b }));
  const confine = () => {
    if (bounds) for (const b of p) if (!b.fixed) keepInside(b, bounds);
  };
  confine();
  for (let it = 0; it < maxIter; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i];
        const b = p[j];
        if (a.fixed && b.fixed) continue;
        const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2) + gap;
        const oy = Math.min(a.y + a.bottom, b.y + b.bottom) - Math.max(a.y + a.top, b.y + b.top) + gap;
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // 덜 겹친 축으로 민다 — 그쪽이 조금만 움직여도 떨어진다. 방향은 둘의 상대 자리에서 (같으면 순서로 가른다)
        const byX = ox < oy;
        const d = byX ? b.x - a.x : b.y + (b.top + b.bottom) / 2 - (a.y + (a.top + a.bottom) / 2);
        const sign = d > 0 || (d === 0 && j > i) ? 1 : -1;
        const push = byX ? ox : oy;
        const ka = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const kb = 1 - ka;
        if (byX) {
          a.x -= sign * push * ka;
          b.x += sign * push * kb;
        } else {
          a.y -= sign * push * ka;
          b.y += sign * push * kb;
        }
      }
    }
    // 민 자리가 밖으로 나갔으면 되돌린다 — 되돌린 자리가 다시 겹치면 다음 바퀴가 또 민다
    confine();
    if (!moved) break;
  }
  return new Map(p.map((b) => [b.id, { x: b.x, y: b.y }]));
}

/** 두 상자(별 자리 기준)가 `gap` 보다 가까운가 */
function tooClose(a: LabelBox, ax: number, ay: number, b: LabelBox, bx: number, by: number, gap: number) {
  return (
    Math.min(ax + a.w / 2, bx + b.w / 2) - Math.max(ax - a.w / 2, bx - b.w / 2) + gap > 1e-6 &&
    Math.min(ay + a.bottom, by + b.bottom) - Math.max(ay + a.top, by + b.top) + gap > 1e-6
  );
}

/**
 * **폰 배치** (S15P21A405-715) — 앞 순위부터 하나씩, 원래 고리 자리에서 **가장 가까운 빈자리**에 놓는다.
 *
 * 폰은 남은 화면이 360 × 354px 남짓이라 안쪽 고리 반지름이 75px 이다. 그 둘레에 이웃 라벨 다섯과 가운데 제목이
 * 함께 들어갈 자리가 없다. 겹친 쌍을 반씩 미는 {@link separateLabels} 는 경계에 막혀 밀고 되돌리기를 되풀이하다
 * 겹친 채 끝났다 — 지도 곡 172개로 만든 고리 201개를 360 × 760 에서 돌리면 겹침 없는 고리가 0% 였다(계산).
 *
 * `boxes` 순서가 우선순위다(고정 상자는 순서와 상관없이 먼저 선다). 원래 자리에서 `maxShift` 안에 빈자리가 없으면
 * 그 라벨은 글자가 숨는다 — 그리는 쪽이 {@link cullLabels} 로 가린다. 그래도 **별은 보여야 하므로** `star`(별만의 상자)가
 * 들어갈 빈자리를 다시 찾는다. 처음엔 경계 안 원래 자리에 두었더니 360px 폰에서 숨은 곡의 별이 옆 라벨의 제목 상자
 * 밑에 깔려 안 보였다(실측, 10위 별이 9위 제목 상자 안). 그 자리도 없으면 경계 안 원래 자리다. 넓은 화면은 안 쓴다.
 */
export function placeLabels(
  boxes: readonly LabelBox[],
  gap: number,
  bounds: LabelBounds,
  maxShift: number,
  star?: { w: number; top: number; bottom: number },
  step = 4,
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  const placed: { b: LabelBox; x: number; y: number }[] = [];
  for (const b of boxes) {
    if (!b.fixed) continue;
    placed.push({ b, x: b.x, y: b.y });
    out.set(b.id, { x: b.x, y: b.y });
  }
  /** 경계 안 원래 자리에서 `maxShift` 안의 가장 가까운 빈자리 (없으면 null) */
  const nearestFree = (b: LabelBox, at: { x: number; y: number }) => {
    // 경계보다 큰 축은 가운데 한 줄만 본다 (keepInside 와 같다)
    const wideX = bounds.x0 + b.w / 2 > bounds.x1 - b.w / 2;
    const wideY = bounds.y0 - b.top > bounds.y1 - b.bottom;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let dx = wideX ? 0 : -maxShift; dx <= (wideX ? 0 : maxShift) + 1e-6; dx += step) {
      for (let dy = wideY ? 0 : -maxShift; dy <= (wideY ? 0 : maxShift) + 1e-6; dy += step) {
        const d = Math.hypot(dx, dy);
        if (d > maxShift + 1e-6 || d >= bestD) continue;
        const x = at.x + dx;
        const y = at.y + dy;
        if (!wideX && (x < bounds.x0 + b.w / 2 - 1e-6 || x > bounds.x1 - b.w / 2 + 1e-6)) continue;
        if (!wideY && (y < bounds.y0 - b.top - 1e-6 || y > bounds.y1 - b.bottom + 1e-6)) continue;
        if (placed.some((q) => tooClose(b, x, y, q.b, q.x, q.y, gap))) continue;
        best = { x, y };
        bestD = d;
      }
    }
    return best;
  };
  for (const b of boxes) {
    if (b.fixed) continue;
    const at = { ...b };
    keepInside(at, bounds);
    const spot = nearestFree(b, at);
    if (spot) {
      placed.push({ b, ...spot });
      out.set(b.id, spot);
      continue;
    }
    // 라벨 자리가 없다 — 별 자리만이라도 비운 곳에. 별만 차지하므로 뒤 순위는 그 둘레를 쓸 수 있다
    const s = star ? { ...b, ...star } : null;
    const sAt = s ? { ...s } : null;
    if (s && sAt) keepInside(sAt, bounds);
    const starSpot = s && sAt ? nearestFree(s, sAt) : null;
    if (s && starSpot) placed.push({ b: s, ...starSpot });
    out.set(b.id, starSpot ?? { x: at.x, y: at.y });
  }
  return out;
}

/** 화면에 그릴 라벨 사각형(px) — {@link cullLabels} 가 받는다 */
export interface LabelRect {
  id: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** 겹쳐도 그린다 (가운데 곡·선택한 곡) */
  keep?: boolean;
}

/**
 * **부딪히는 라벨은 글자를 숨긴다** (S15P21A405-715, 폰만). `rects` 순서가 우선순위다 — 앞에서 그리기로 한 것과
 * `gap` 보다 가까우면 숨긴다. `keep` 은 늘 그리고 뒤 라벨을 가린다. 별은 그대로 그려지고 누를 수 있다 — 누르면 선택한
 * 곡이 되어 늘 보인다. 지도 라벨이 부딪힐 때 낮은 순위부터 빼는 것과 같다. 숨긴 id 를 돌려준다.
 */
export function cullLabels(rects: readonly LabelRect[], gap: number): Set<number> {
  const hidden = new Set<number>();
  const shown: LabelRect[] = [];
  const hit = (a: LabelRect, b: LabelRect) =>
    Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + gap > 1e-6 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + gap > 1e-6;
  for (const r of rects) if (r.keep) shown.push(r);
  for (const r of rects) {
    if (r.keep) continue;
    if (shown.some((s) => hit(s, r))) hidden.add(r.id);
    else shown.push(r);
  }
  return hidden;
}

/**
 * 글자 폭 어림(px). 엔진에는 캔버스가 없어 `measureText` 를 못 쓴다 — 한글·한자처럼 넓은 글자와 그 밖을 둘로
 * 나눠 더한다. 겹침을 막는 데 쓰므로 조금 넉넉하게 잡는다.
 */
export function approxTextWidth(text: string, px: number, mono = false): number {
  let w = 0;
  for (const ch of text) w += (ch.codePointAt(0) ?? 0) >= 0x1100 ? px * 1.0 : px * (mono ? 0.64 : 0.6);
  return w;
}
