/**
 * 커버를 화면에 고루 뿌리는 순서 정하기 (S15P21A405-518).
 *
 * 예전에는 후보를 배열 순서대로 훑어 앞에서부터 집었다. `weight` 정렬이 붙어 있었지만 실데이터는
 * 전부 0 이라 정렬이 아무것도 안 했고, 결국 **상주 집합이 담겨 온 순서**가 곧 우선순위였다 —
 * 그 순서가 좌표와 상관있어서 커버가 화면 왼쪽에만 우르르 몰렸다. 최소 간격 검사는 54px 겹침만
 * 막을 뿐 "고루 퍼짐" 을 만들어 주지 못한다.
 *
 * 그래서 **화면을 커버 수만큼 칸으로 나누고 칸마다 하나씩** 집는다. 그리는 쪽에서 떼어 둔 이유는
 * 이 규칙만 따로 검사할 수 있게 하기 위해서다 (`tests/cover-spread.test.cjs`).
 */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * `n` 개를 담을 칸 나누기. 화면이 가로로 길면 열이 많아진다 — 정사각 칸에 가깝게 나눠야
 * 한쪽 방향으로만 촘촘해지지 않는다.
 */
export function gridFor(n: number, rect: Rect): { cols: number; rows: number } {
  const w = Math.max(1, rect.x1 - rect.x0);
  const h = Math.max(1, rect.y1 - rect.y0);
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
  return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
}

/** 이 점이 몇 번째 칸인가 (좌상단부터 행 우선) */
export function cellOf(x: number, y: number, rect: Rect, cols: number, rows: number): number {
  const w = Math.max(1, rect.x1 - rect.x0);
  const h = Math.max(1, rect.y1 - rect.y0);
  const cx = clamp(Math.floor(((x - rect.x0) / w) * cols), 0, cols - 1);
  const cy = clamp(Math.floor(((y - rect.y0) / h) * rows), 0, rows - 1);
  return cy * cols + cx;
}

/**
 * 후보를 **칸마다 하나씩 앞세운** 순서로 돌려준다.
 *
 * @param candidates 고를 수 있는 후보 (이미 화면 안이라고 본다)
 * @param at         그 후보의 화면 좌표
 * @param taken      이미 커버가 서 있는 칸은 건너뛴다 — 새 커버는 늘 비어 있는 쪽으로 간다
 *
 * 칸이 비어 남을 수 있으므로 **한 칸에 둘 이상 몰린 나머지도 뒤에 붙여** 돌려준다. 앞쪽만으로
 * 개수가 안 차면 그걸로 메우면 된다.
 */
export function spreadOrder(
  candidates: readonly number[],
  at: (i: number) => { x: number; y: number },
  rect: Rect,
  n: number,
  taken: ReadonlySet<number> = new Set(),
): number[] {
  const { cols, rows } = gridFor(n, rect);
  const first = new Map<number, number>();
  const rest: number[] = [];
  for (const i of candidates) {
    const { x, y } = at(i);
    const key = cellOf(x, y, rect, cols, rows);
    if (taken.has(key)) continue;
    if (first.has(key)) rest.push(i);
    else first.set(key, i);
  }
  return [...first.values(), ...rest];
}
