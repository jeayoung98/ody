import type { Id } from "./common";

/** PCA 임베딩 좌표 pc1~pc16 (VECTOR(16)) */
export type Location16 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/**
 * 백엔드가 내려주는 좌표 형태 (API 명세서 §0.6 Location) — 배열이 아니라 pc1~pc16 필드다.
 * 지도 엔진은 인덱스 접근이 필요하므로 API 경계에서 `toLocation16` 으로 배열로 바꿔 쓴다.
 */
export interface Location {
  pc1: number; pc2: number; pc3: number; pc4: number;
  pc5: number; pc6: number; pc7: number; pc8: number;
  pc9: number; pc10: number; pc11: number; pc12: number;
  pc13: number; pc14: number; pc15: number; pc16: number;
}

/** Location(pc1~pc16 객체) → 지도 엔진이 쓰는 16칸 배열 */
export function toLocation16(l: Location): Location16 {
  return Array.from({ length: 16 }, (_, i) => l[`pc${i + 1}` as keyof Location]) as Location16;
}

/** music 테이블 */
export interface Music {
  /** 곡 ID */
  id: Id;
  /** MusicBrainz recording MBID(36자 UUID) 또는 SHA-1 경로 해시 폴백(40자) */
  mbid: string;
  /** 곡명 */
  title: string;
  /** 아티스트명 */
  artist: string | null;
  /** 발매 연도 */
  releaseYear: number | null;
  /** BPM, 소수 1자리 */
  bpm: number | null;
  /** 재생 길이(초) */
  duration: number | null;
  /** 앨범명 */
  album: string | null;
  /**
   * YouTube **검색** URL. NULL이면 재생 불가.
   * 재생 URL 이 아니다 — 규칙 6 상 `videoId` 없는 곡은 검색 URL 만 허용된다.
   */
  youtubeUrl: string | null;
  /**
   * 공식 플레이어 임베드용 YouTube 영상 ID (규칙 6 D15 개정). 있으면 **사이트 안에서** 재생한다.
   *
   * 백엔드가 `map_sample` 과 검색 상위에 한해 확보한다 (`data/specs/18_db_ingest/spec.md`).
   * **2026-09-14 실호출 기준 전 곡이 null 이다** — 수집 스크립트가 아직 안 돌았다.
   * 그동안은 `youtubeUrl` 검색 링크로 떨어진다.
   */
  videoId: string | null;
  /** PCA 임베딩 좌표 pc1~pc16 */
  location: Location16 | null;
  /** 누적 재생 수, 배치 갱신 */
  playCnt: number;
  /** 매핑된 YouTube 후보 영상 수 */
  youtubeCnt: number;
}

/** genre 테이블 */
export interface Genre {
  /** 장르 ID */
  id: Id;
  /** 장르명 */
  name: string;
}

/** music_genre 테이블 (music ↔ genre 다대다 매핑) */
export interface MusicGenre {
  id: Id;
  /** 곡 ID */
  musicId: Id;
  /** 장르 ID */
  genreId: Id;
}

/** 장르가 조인된 곡 (조회용) */
export interface MusicWithGenres extends Music {
  genres: Genre[];
}

/** 재생 가능한 곡 (youtubeUrl이 반드시 존재) */
export type PlayableMusic = Music & { youtubeUrl: string };
