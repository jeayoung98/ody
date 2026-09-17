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
  /**
   * 고정 주성분 16개. `axis` 는 0-based 축 번호, `value` 는 **원값**이다.
   *
   * 이름도 정규화도 화면이 한다 (`pcAxisPair` · `pcStats`). 축마다 흩어진 폭이 달라서
   * 어느 축이 이 곡을 설명하는지는 상주 집합의 폭으로 재야 알 수 있고, 그 잣대를 가진
   * 쪽은 지도 엔진이다 (S15P21A405-355).
   */
  principalComponents: { axis: number; value: number }[];
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

/**
 * 검색 조건 (SEARCH-01 확장, S15P21A405-399).
 *
 * 검색바는 **하나**지만 경로가 셋이다. 두 조건을 **둘 다 칩으로 굳히는 상태는 만들지 않는다** —
 * 첫 조건만 칩으로 고정하고 두 번째는 입력값으로 두면 세 경로가 전부 표현된다.
 *
 * - `all` 입력 하나를 제목·아티스트 양쪽에서 찾는다
 * - `artist` 아티스트를 고정한다. `music` 은 그 안에서 더 좁히는 선택 조건이라 비어도 된다
 * - `music` 음악을 고정한다. `artist` 가 비면 제목만 찾고, 값이 생기면 그 아티스트로 좁힌다
 */
export type SearchCondition =
  | { mode: "all"; query: string }
  | { mode: "artist"; artist: string; music: string }
  | { mode: "music"; music: string; artist: string };
