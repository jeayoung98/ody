/** localStorage / sessionStorage 키 */
export const STORAGE_KEYS = {
  /** 액세스 토큰. 모든 API 요청에 `Authorization: Bearer` 로 붙는다 (API 명세서 §0.1) */
  accessToken: "ody:access-token",
  /** 내 곡(=내 위치) musicId. 없으면 튜토리얼로 보낸다 */
  myMusicId: "ody:my-music-id",
  /** 튜토리얼 건너뛰기/완료 로컬 캐시 */
  tutorialDone: "ody:tutorial-done",
} as const;
