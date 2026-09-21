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
  /**
   * 이 곡이 실린 **앨범**의 MusicBrainz 릴리스 ID (S15P21A405-518). `mbid` 는 곡(recording) 쪽이라
   * 앨범 커버를 못 찾는다 — 커버를 여는 열쇠는 이 값이다 (`render/cover-art`).
   *
   * 백엔드가 `album_mbid` 로 내려주기로 한 필드라 **아직 안 올 수 있다.** 없으면 절차적 커버로 떨어진다.
   */
  albumMbid?: string | null;
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
   * **`videoId` 는 여기 없다** (S15P21A405-340). 공식 플레이어 임베드용 영상 ID 는 전용
   * 엔드포인트가 출처다 — `useVideoIdQuery` / `GET /bff/music/{id}/video-id`.
   *
   * 곡 상세 응답에도 딸려 오지만 그걸 쓰지 않는다. 그 응답은 주변 10곡 것까지 함께 싣고 있어서
   * (실측 11개), 백엔드가 그 필드를 빼는 순간 프론트가 깨진다. 출처를 하나로 두어 안 흔들리게 한다.
   */
  /** PCA 임베딩 좌표 pc1~pc16 */
  location: Location16 | null;
  /** 누적 재생 수, 배치 갱신 */
  playCnt: number;
  /** 매핑된 YouTube 후보 영상 수 */
  youtubeCnt: number;
}

/*
 * `Genre` · `MusicGenre` · `MusicWithGenres` 를 걷어냈다 (장르 원천이 사라졌다 (S15P21A405-490, BACKEND-NOTES A-47)).
 * 백엔드가 `genre`·`music_genre` 테이블을 지우면서 응답에서 장르 이름이 사라졌다 —
 * 읽을 원천이 없는 타입을 남겨 두면 다음 사람이 "채우면 되겠네" 로 읽는다.
 *
 * **`Music.genreId` 는 남는다.** 지도 별 색이 쓰는 값이고 지금은 무장르(10) 고정이다.
 */

/** 재생 가능한 곡 (youtubeUrl이 반드시 존재) */
export type PlayableMusic = Music & { youtubeUrl: string };

/**
 * `videoId` 조회가 어디까지 갔는가 (S15P21A405-332, S15P21A405-364).
 *
 * **`"none"` 과 `null` 은 다르다.** 백엔드는 유튜브 검색을 **해봤는데 없었을 때** 문자열
 * `"none"` 을 주고, **아직 검색해보지 않았을 때** `null` 을 준다. 둘을 같게 뭉개면
 * "기다려도 안 되는 곡" 과 "다시 부르면 채워질 곡" 이 한 화면이 되어, 어느 쪽이든 거짓말이 된다.
 */
export type VideoIdLookup =
  /** 영상이 있다 — 사이트 안에서 틀 수 있다 */
  | "found"
  /** 검색했지만 없었다 (`"none"`). 다시 눌러도 같은 답이다 */
  | "notFound"
  /** 아직 검색 전이다 (`null`). 다시 부르면 채워질 수 있다 */
  | "unsearched";
