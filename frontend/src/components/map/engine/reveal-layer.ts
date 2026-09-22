/**
 * 검색한 곡을 보여 주려면 **어느 겹으로 올라가야 하는가** (S15P21A405-581).
 *
 * 겹은 사용자에게 확대로 보이지만 실제로는 필터다. 파고들수록 곡이 걸러지므로, 지금 겹에 없는
 * 곡은 **위 어딘가**에는 있을 수 있다. 파고들며 남겨 둔 프레임마다 그 겹의 상주 집합이 들어
 * 있으니, 거슬러 올라가며 그 곡을 처음 만나는 겹을 찾으면 된다.
 *
 * **가장 가까운 겹에서 멈추는 것이 핵심이다.** 예전 명세(v1.3)는 그 곡이 대표곡인 첫 레이어로
 * 바로 뛰었고, 검색 한 번에 파고든 경로가 통째로 날아가는 것이 커서 고스트별로 대체됐다
 * (SEARCH-01 비고). 필요한 만큼만 올라가면 그 아래 경로만 잃는다.
 */
export interface LayerResidency {
  layer: number;
  /** 그 겹의 상주 마스크. 곡 색인으로 찾는다 */
  subset: ArrayLike<number>;
}

/**
 * 그 곡이 상주하는 겹 가운데 **지금 겹에서 가장 가까운(= 가장 깊은)** 겹.
 *
 * 어느 겹에도 없으면 `null` 이다. 그때는 부르는 쪽이 최상위로 올려 그 자리에 끼워 넣는다 —
 * 서버가 준 상주 집합은 겹마다 top-k 라, 카탈로그에 있어도 어느 집합에도 안 들 수 있다.
 *
 * **프레임 순서를 믿지 않는다.** 지금은 파고든 차례대로 쌓이지만, 그 가정이 깨져도 답이
 * 달라지지 않게 가장 큰 겹 번호를 고른다.
 *
 * 마스크가 곡 색인보다 짧으면 `undefined` 가 나오고 그대로 "없음" 으로 읽힌다. 실제로 그런
 * 일이 생긴다 — 곡을 새로 편입(`adopt`)하면 색인이 뒤에 붙는데, 그 전에 쌓인 프레임의 마스크는
 * 그만큼 짧다. 그 곡은 애초에 어느 겹의 top-k 에도 없던 곡이라 "없음" 이 맞는 답이다.
 */
export function nearestLayerWith(frames: readonly LayerResidency[], songIndex: number): number | null {
  let best: number | null = null;
  for (const f of frames) {
    if (!f.subset[songIndex]) continue;
    if (best == null || f.layer > best) best = f.layer;
  }
  return best;
}
