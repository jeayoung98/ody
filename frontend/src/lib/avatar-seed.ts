/**
 * 절차적 아바타 시드 — 목 시절과 같은 방식이라 같은 사람은 같은 얼굴이다.
 *
 * `use-viewport-subscription` 안에 있던 것을 끌어냈다 (S15P21A405-536). 봇을 `NearbyUser` 로
 * 바꾸는 쪽(`lib/bots/adapt`)도 이게 필요한데, 그 훅에서 가져오면 두 모듈이 서로를 부르게 된다.
 */
export function seedOf(email: string): number[] {
  let h = 2166136261;
  for (const ch of email) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  return Array.from({ length: 6 }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return ((h >>> (i % 8)) % 1000) / 1000;
  });
}
