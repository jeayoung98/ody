import type { Id } from "./common";
import type { Genre, Music } from "./music";
import type { Playlist } from "./playlist";

/**
 * 곡 상세 패널 응답.
 * albumCoverUrl / country / language / composer / lyricist / moods 는 ERD에 없는 필드.
 * 백엔드 확인 필요 — 확정 전까지 optional 로 둔다.
 */
export interface MusicDetail extends Music {
  albumCoverUrl?: string | null;
  /** 발매 국가 */
  country?: string | null;
  /** 언어 */
  language?: string | null;
  composer?: string | null;
  lyricist?: string | null;
  /** 무드 태그 */
  moods?: string[];
  genres: Genre[];
  /** 고정 주성분 값 (pc1~pc16 중 노출할 것) */
  principalComponents: { label: string; value: number }[];
  /** 가까운 10곡 */
  nearby: Pick<Music, "id" | "title" | "artist">[];
  /** 관련 플레이리스트 */
  relatedPlaylists: Pick<Playlist, "id" | "playlistName" | "email">[];
}

/** 검색 결과 항목. 지도 위치는 id로 지도 데이터에서 찾는다 */
export interface MusicSearchResult {
  id: Id;
  title: string;
  artist: string | null;
}

/**
 * 검색 결과 한 페이지 (SEARCH-01).
 * 전체 건수는 받지 않는다 — 백엔드도 `hasNext` 만 주고, 무한 스크롤에 필요한 것도 그것뿐이다.
 */
export interface MusicSearchPage {
  items: MusicSearchResult[];
  /** 0-based */
  page: number;
  hasNext: boolean;
}
