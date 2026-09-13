/** localStorage / sessionStorage 키 */
export const STORAGE_KEYS = {
  /** 액세스 토큰. 모든 API 요청에 `Authorization: Bearer` 로 붙는다 (API 명세서 §0.1) */
  accessToken: "ody:access-token",
  /** 내 곡(=내 위치) musicId. 없으면 튜토리얼로 보낸다 */
  myMusicId: "ody:my-music-id",
  /**
   * "내 위치로 가기" 가 돌아갈 자리 — `{ musicId, boxes }`.
   * `boxes` 는 그 겹까지 좁혀 온 누적 범위라 **겹까지 그대로 되돌아가려면 이것도 있어야 한다.**
   * 이게 없으면 새로고침 뒤 버튼이 꺼진다 (S15P21A405-275).
   */
  myHome: "ody:my-home",
  /**
   * 마지막으로 재생한 곡 musicId. 새로고침해도 플레이어바에 남아 유튜브로 이어 들을 수 있다.
   * **소리를 자동으로 다시 틀지는 않는다** (규칙 6 — 음원은 앱 밖에서 듣는다).
   */
  playingMusicId: "ody:playing-music-id",
  /** 튜토리얼 건너뛰기/완료 로컬 캐시 */
  tutorialDone: "ody:tutorial-done",
} as const;
