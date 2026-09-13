import { STAR_LOOK } from "@/constants";
import { GENRE_COLORS, genreIdx } from "@/constants/design-tokens";
import type { MapPoint } from "@/types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 정수 → [0, 1) 결정적 해시. 같은 곡은 언제나 같은 값이다 */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  // XOR 결과는 부호 있는 32비트라 음수가 될 수 있다 — 그대로 나누면 음수 해시가 나와 색 인덱스가 배열 밖으로 나간다
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** 가중치 → 0~1 등급 (로그 스케일, 재생수 10^2.6 ~ 10^6.8) */
export function magOf(weight: number) {
  return clamp((Math.log10(Math.max(1, weight)) - 2.6) / 4.2, 0, 1);
}

/**
 * 별의 크기 등급(0~1). 임시로 musicId 해시를 쓴다 — 실데이터 weight 가 전부 0 이라 등급이 다 같기 때문이다.
 * `STAR_LOOK.randomSize` 를 내리면 재생수 계산으로 돌아간다 (S15P21A405-283)
 */
export function starMag(s: MapPoint): number {
  return STAR_LOOK.randomSize ? hash01(s.musicId) : magOf(s.weight);
}

/** 별 색 인덱스(GENRE_COLORS). 임시로 musicId 해시, 스위치를 내리면 genreId 매핑 */
export function starColorIdx(s: MapPoint): number {
  return STAR_LOOK.randomColor ? Math.floor(hash01(s.musicId * 31 + 7) * GENRE_COLORS.length) : genreIdx(s.genreId);
}

export function starRgb(s: MapPoint): readonly [number, number, number] {
  return GENRE_COLORS[starColorIdx(s)];
}
