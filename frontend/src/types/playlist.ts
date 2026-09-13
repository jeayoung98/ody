import type { Email, Id, ISODateString } from "./common";
import type { Music } from "./music";

/** playlist 테이블 */
export interface Playlist {
  /** 플레이리스트 ID */
  id: Id;
  /** users.email, 소유자 */
  email: Email;
  /** 플레이리스트명, 소유자 내 유일 */
  playlistName: string;
  /** 좋아요 수 */
  likeCnt: number | null;
  /** 생성 시각 */
  createdAt: ISODateString;
  /** 수정 시각, 이름 변경/곡 추가 시 갱신 */
  updatedAt: ISODateString;
}

/** playlist_item 테이블 — (playlist_id, music_id) 복합 PK */
export interface PlaylistItem {
  /** 플레이리스트 ID */
  playlistId: Id;
  /** 곡 ID */
  musicId: Id;
  /** 추가 시각. 백엔드 상세 응답(`/api/playlist/detail`)에는 없어 null 로 온다 — BACKEND-NOTES 필드 대조 */
  addedAt: ISODateString | null;
}

/** 곡 정보가 조인된 플레이리스트 항목 (조회용) */
export interface PlaylistItemWithMusic extends PlaylistItem {
  music: Music;
}

/**
 * 플레이리스트 상세 패널 응답.
 * 백엔드 `PlaylistDetailResponse` 에는 소유자(`email`)·생성/수정 시각·좋아요·무드 태그가 **없다**
 * (BACKEND-NOTES 필드 대조). 실연동(S15P21A405-214)에서는 지어내지 않고 null/빈값으로 채운다 —
 * 그래서 이 세 필드는 ERD 와 달리 null 을 허용한다
 */
export interface PlaylistDetail extends Omit<Playlist, "email" | "createdAt" | "updatedAt"> {
  email: Email | null;
  createdAt: ISODateString | null;
  updatedAt: ISODateString | null;
  ownerNickname: string | null;
  /** 무드 태그 (최대 3개) */
  moodTags: string[];
  itemCount: number;
  /** 총 재생 시간(초) */
  totalDuration: number;
  /** 내가 좋아요 했는지 */
  isLiked: boolean;
  items: PlaylistItemWithMusic[];
}

/** 플레이리스트 목록 항목 (피드 내 플리 / 좋아요한 플리) */
export type PlaylistSummary = Pick<Playlist, "id" | "playlistName" | "likeCnt"> & {
  itemCount: number;
  ownerNickname: string | null;
};
