/**
 * 주변 탐색 라벨이 **서로 가리지 않게** 별 자리를 민다 (S15P21A405-697).
 *
 * 고리 배치는 각도만으로 정해져서, 제목이 긴 이웃 둘이 붙으면 라벨 상자가 겹쳤다. 잘라 쓰면(말줄임) 뒷부분을 못
 * 보고, 흘려 쓰면(마퀴) 정신없다 — 그래서 글은 다 보이게 두고 **자리를 민다.** 상자끼리 `gap` 만큼 떨어질 때까지
 * 겹친 쌍을 덜 겹친 축으로 반씩 밀어낸다. 고정된 상자(가운데 곡)는 안 움직이고 상대가 다 밀린다.
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

/** 겹친 쌍이 없어질 때까지(또는 `maxIter` 번) 민 뒤의 별 자리 */
export function separateLabels(boxes: readonly LabelBox[], gap: number, maxIter = 160): Map<number, { x: number; y: number }> {
  const p = boxes.map((b) => ({ ...b }));
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
    if (!moved) break;
  }
  return new Map(p.map((b) => [b.id, { x: b.x, y: b.y }]));
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
