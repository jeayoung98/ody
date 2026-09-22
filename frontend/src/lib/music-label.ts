import type { MusicHint } from "./music-hints";

/** 화면에 띄울 곡 이름표 */
export interface MusicLabel {
  title: string;
  artist: string | null;
  /** 아직 상세가 없어 힌트로 버티는 중인가 */
  isHint: boolean;
}

/**
 * 무엇을 보여 줄지 고르는 규칙 (S15P21A405-585). **상세 > 힌트 > `Track <id>`** 순이다.
 *
 * 아티스트는 제목과 따로 고르지 않는다 — 상세가 왔으면 아티스트가 비어 있는 것도 그쪽 답이라
 * 힌트로 덮지 않는다. 제목만 상세, 아티스트만 힌트인 줄이 서면 한 곡의 정보가 두 출처에서
 * 섞여 나온다.
 */
export function resolveMusicLabel(
  musicId: number | null,
  detail: { title: string; artist: string | null } | undefined,
  hint: MusicHint | undefined,
): MusicLabel {
  if (detail) return { title: detail.title, artist: detail.artist, isHint: false };
  if (hint) return { title: hint.title, artist: hint.artist, isHint: true };
  return { title: musicId != null ? `Track ${musicId}` : "", artist: null, isHint: false };
}
