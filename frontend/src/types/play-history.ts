import type { Email, Id, ISODateString } from "./common";

/** play_history.source — 재생이 발생한 진입점 */
export const PLAY_SOURCES = ["MAP", "JOURNEY", "PLAYLIST", "FOLLOW"] as const;
export type PlaySource = (typeof PLAY_SOURCES)[number];

/** play_history 테이블 */
export interface PlayHistory {
  /** 재생 로그 ID */
  id: Id;
  /** musics.id */
  musicId: Id;
  /** users.email, 탈퇴 시 NULL(익명화) */
  email: Email | null;
  /** MAP / JOURNEY / PLAYLIST / FOLLOW */
  source: PlaySource;
  /** 재생 시간(ms) */
  playedMs: number;
  /** 재생 시각 */
  playedAt: ISODateString;
}
