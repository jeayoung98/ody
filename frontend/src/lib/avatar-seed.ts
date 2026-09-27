/**
 * 절차적 아바타 시드 — 목 시절과 같은 방식이라 같은 사람은 같은 얼굴이다.
 *
 * 이메일마다 늘 같은 [0, 1) 수열이라, 사람마다 고정된 값이 필요한 다른 자리(`botFollowerBonus`)도 쓴다.
 */
export function seedOf(email: string): number[] {
  let h = 2166136261;
  for (const ch of email) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  return Array.from({ length: 6 }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return ((h >>> (i % 8)) % 1000) / 1000;
  });
}
