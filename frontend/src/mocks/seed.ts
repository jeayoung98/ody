/** 결정적(seeded) 난수. 새로고침해도 같은 목 데이터가 나오도록 */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
