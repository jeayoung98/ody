import type { Id } from "./common";

/** PC 차원 수 = ERD music.location VECTOR(16). 레이어 l 은 pc[2l], pc[2l+1] 을 축으로 쓴다 */
export const PC_DIMS = 16;

/**
 * 지도 위 한 점(별). 그리는 데 필요한 최소 정보 + 재투영용 PC 벡터.
 * 좌표는 클라이언트가 현재 레이어 축(pc[2l], pc[2l+1])으로 계산한다.
 */
export interface MapPoint {
  musicId: Id;
  /** 표준화된 주성분 점수 16개 (ERD location) */
  pc: number[];
  /** 색상 코딩용 장르 ID */
  genreId: Id;
  /** 별 크기·밝기 계산용 (재생수 등) */
  weight: number;
  title: string;
  artist: string | null;
  /** 미리듣기 링크 유무 (없으면 흐리게) */
  playable: boolean;
  /**
   * 목 확인용 — 어느 겹에도 상주하지 않는 곡. 검색해서 고르면 늘 고스트별로 뜬다 (MAP-12 UI 확인).
   * 실서비스에서는 백엔드가 겹의 상주 집합만 내려주므로 이 플래그 없이 자연히 고스트가 된다.
   */
  ghostOnly?: boolean;
}

/** 특정 곡 기준 주변 탐색 응답 — 유사도는 16차원 임베딩 거리 */
export interface NearbyResponse {
  center: MapPoint;
  neighbors: MapPoint[];
}

/** 카메라: 현재 레이어 좌표계(PC 단위)의 중심과 배율(px / PC 단위) */
export interface MapCamera {
  cx: number;
  cy: number;
  s: number;
}

/**
 * 한 겹에서 뷰포트가 좁힌 사각 범위 (백엔드 `LayerBox` 와 1:1).
 * 레이어 l 의 평면은 pc[2l]·pc[2l+1] 이고, 서버 쪽 level 은 1-based 라 level = l + 1 이다.
 * 이 범위를 겹마다 쌓아 다음 겹 상주 집합을 요청한다 — 누적이 candidate(N+1) ⊆ candidate(N) 을 만든다.
 */
export interface LayerBox {
  /** 0-based 레이어 번호 */
  layer: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
