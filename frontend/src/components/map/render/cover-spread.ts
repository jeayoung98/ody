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

/**
 * 커버 자리를 누구에게 먼저 줄지 (S15P21A405-528).
 *
 * **앨범 ID 있음 > 재생수 높음 > 받은 순서.**
 *
 * 첫 조건이 실질적으로 전부다. `albumMbid` 가 없는 곡은 아무리 상위여도 절차적 그림밖에 못
 * 그리는데, 커버 자리는 화면에 열몇 개뿐이라 그 자리를 진짜 그림에게 주는 편이 낫다.
 * `weight` 는 지금 실데이터가 전부 0 이라 사실상 동점이고, 그러면 받은 순서가 남는다 —
 * 그건 안정 정렬이 알아서 지켜 준다.
 */
export function byCoverPriority<T>(hasAlbum: (v: T) => boolean, weightOf: (v: T) => number) {
  return (a: T, b: T) => {
    const d = Number(hasAlbum(b)) - Number(hasAlbum(a));
    return d !== 0 ? d : weightOf(b) - weightOf(a);
  };
}

/**
 * **지난번에 뽑힌 것을 앞세운 색인 순서** (S15P21A405-542).
 *
 * `spreadOrder` 는 한 칸에 여럿이 몰리면 **먼저 만난 것**을 그 칸의 주인으로 삼는다. 그런데
 * 칸 경계는 화면에 걸려 있어서 카메라가 움직이면 같이 움직인다 — 후보 순서가 그대로여도
 * 누가 어느 칸에 드느냐가 프레임마다 바뀌고, 그러면 지도를 미는 동안 사람이 깜빡인다.
 *
 * 이미 서 있던 쪽을 먼저 보게 하면 그 사람이 제 칸을 계속 지킨다. 안정 정렬이라 같은 무리
 * 안에서는 원래 순서가 유지된다 — 새로 들어오는 쪽도 매 프레임 자리를 다투지 않는다.
 */
export function keptFirst<T>(items: readonly T[], kept: (v: T) => boolean): number[] {
  const stay: number[] = [];
  const rest: number[] = [];
  items.forEach((v, i) => (kept(v) ? stay : rest).push(i));
  return [...stay, ...rest];
}
