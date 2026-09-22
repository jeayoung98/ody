/**
 * 봇의 생활 시뮬레이션 — **순수 함수** (S15P21A405-536).
 *
 * 화면도 엔진도 시계도 모르고, 넣은 값만 보고 다음 상태를 돌려준다. 떼어 낸 이유는 이 규칙이
 * "가짜 티가 나느냐" 를 통째로 결정하기 때문이다 — 청취 길이가 다양한지, 겹을 가끔만 옮기는지,
 * 오프라인이 섞이는지. 눈으로 몇 분 보고 판단할 수 있는 것이 아니라 수치로 묶어야 한다
 * (`tests/bot-sim.test.cjs`).
 *
 * 봇이 **어느 곡을 고르는지는 여기 없다.** 그건 지도 엔진이 들고 있는 상주 집합을 봐야 하는
 * 일이고, 그걸 끌고 들어오면 이 파일을 테스트할 수 없어진다. 곡은 부르는 쪽이 붙인다.
 */

import { BOTS } from "@/constants/bots";
import { LAYER_COUNT } from "@/constants/map";

/** 봇 한 명의 지금 상태. 이 한 덩이가 끝나면 다음 것으로 넘어간다 */
export interface BotEpisode {
  /** 몇 번째인가. 난수 시드의 일부라 같은 봇이라도 매번 다른 값이 나온다 */
  index: number;
  /** 접속해 있는가. false 면 자리를 비운 구간이고 곡도 겹도 의미가 없다 */
  online: boolean;
  layer: number;
  /**
   * 듣고 있는 곡. **`null` 일 수 있다** — 내가 있는 겹이 아니면 고를 수 있는 곡 자체가
   * 없기 때문이다(엔진은 지금 겹의 상주 집합만 들고 있다). 부르는 쪽이 겹이 맞는 순간에 채운다.
   */
  musicId: number | null;
  startedAt: number;
  endsAt: number;
}

/**
 * 시드에서 뽑는 [0,1) 난수.
 *
 * `Math.random()` 이 아닌 이유는 **같은 입력이면 같은 결과**여야 테스트가 되기 때문이다.
 * `salt` 로 한 에피소드 안에서 여러 번 다른 값을 뽑는다.
 */
export function rnd(seed: number, index: number, salt: number): number {
  let h = Math.imul(seed, 2654435761) ^ Math.imul(index, 40503) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const between = (r: number, range: readonly [number, number]) => range[0] + r * (range[1] - range[0]);

/**
 * 다음 겹. **사람 있는 쪽으로 끌리고, 가끔 떠난다.**
 *
 * 규칙이 두 줄인 이유가 있다. "가끔 옮긴다" 한 줄로 두면 여덟 겹에 고르게 흩어져 내 화면에는
 * 평균 한 명이 남는다 — 만날 수가 없다는 원래 문제가 그대로 돌아온다. 반대로 늘 따라오게 하면
 * 겹을 옮길 때마다 여덟 명이 통째로 순간이동해 사람이 아니라 그림자로 보인다.
 *
 * 그래서 **내 겹에 있으면 가끔 떠나고, 딴 데 있으면 자주 돌아온다.** 이 두 확률의 비가 곧
 * 정착 비율이다 — 지금 값이면 여덟 중 예닐곱이 내 겹에 있고 한둘은 딴 데 가 있다.
 */
export function nextLayer(prev: BotEpisode | null, preferredLayer: number, r: (salt: number) => number): number {
  const home = clampLayer(preferredLayer);
  // 처음 등장하는 봇은 나와 같은 겹에서 시작한다 — 안 그러면 로그인 직후 화면이 여전히 비어 있다
  if (prev == null) return home;
  if (prev.layer === home) return r(2) < BOTS.layerHopChance ? Math.floor(r(4) * LAYER_COUNT) : prev.layer;
  return r(3) < BOTS.homePull ? home : prev.layer;
}

const clampLayer = (n: number) => Math.min(LAYER_COUNT - 1, Math.max(0, Math.floor(n)));

/**
 * 이 봇의 다음 에피소드.
 *
 * **자리를 비운 다음에는 반드시 돌아온다.** 오프라인이 연달아 붙으면 한 번 사라진 봇이 십수 분
 * 넘게 안 보이는데, 여덟 명뿐이라 그 사이 화면이 도로 비어 버린다.
 */
export function nextEpisode(seed: number, prev: BotEpisode | null, now: number, preferredLayer: number): BotEpisode {
  const index = (prev?.index ?? -1) + 1;
  const r = (salt: number) => rnd(seed, index, salt);
  const online = prev == null || !prev.online || r(1) >= BOTS.offlineChance;
  const layer = nextLayer(prev, preferredLayer, r);

  return {
    index,
    online,
    layer,
    musicId: null,
    startedAt: now,
    endsAt: now + Math.round(between(r(5), online ? BOTS.listenMs : BOTS.offlineMs)),
  };
}
