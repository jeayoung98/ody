import type { Id } from "./common";
import type { Music } from "./music";

/** 여정 경로 응답 */
export interface JourneyRoute {
  startMusicId: Id;
  endMusicId: Id;
  /** 출발→도착 순서의 정거장 곡 목록 (최대 JOURNEY_MAX_SONGS). 지도 좌표는 곡 ID로 지도 데이터에서 찾는다 */
  stops: JourneyStop[];
  /** 총 재생 시간(초) */
  totalDuration: number;
}

export interface JourneyStop extends Pick<Music, "id" | "title" | "artist" | "duration"> {
  order: number;
  genreName: string | null;
}
