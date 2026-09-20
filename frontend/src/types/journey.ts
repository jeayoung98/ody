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
  /**
   * 16차원 좌표. 경로 곡은 **지도 상주 집합 밖일 수 있어서** 프론트가 좌표를 따로 알 길이 없다 —
   * 별자리 배치(PATH-01)를 만들려면 여기서 함께 받아야 한다. 없으면 0으로 채운다
   */
  pc: number[];
}
