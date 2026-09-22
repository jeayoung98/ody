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
  /** 테스트 안내 화면을 봤는가 (S15P21A405-343). 한 번 보면 다시 띄우지 않는다 */
  testGuideSeen: "ody:test-guide-seen",
  /**
   * 설문 모드 스위치 (S15P21A405-383). 없거나 `true` 면 설문 모드(기본), `false` 면 개발 모드.
   * 읽는 쪽은 [`useSurveyMode`](../hooks/use-survey-mode.ts) 하나다.
   */
  surveyMode: "ody:survey-mode",
  /**
   * 좁은 화면 게이트를 넘는다 (S15P21A405-421). `false` 면 넘고, 없으면 게이트가 산다 —
   * 값 규칙을 `surveyMode` 와 맞춰 뒀다. 읽는 쪽은 CSS 라 [`dev-mode.ts`](./dev-mode.ts) 의
   * 인라인 스크립트가 `<html>` 클래스로 옮긴다. 게이트를 걷어낼 때(S15P21A405-419) 같이 지운다.
   */
  gateOff: "ody:gate-off",
  /** 없거나 `true`면 분석 전송, `false`면 이 브라우저의 GA4·PostHog 수집을 모두 끈다. */
  analyticsMode: "ody:analytics-mode",
  /** `true`일 때 이 브라우저의 GA4 이벤트만 DebugView 대상으로 표시한다. */
  analyticsDebug: "ody:analytics-debug",
  /**
   * 발견 힌트를 이미 본 문맥들 (S15P21A405-393). `["map","nearby","journey"]` 꼴의 배열.
   * 문맥마다 키를 따로 두지 않는 이유는 힌트가 늘어날 때 키가 문맥 수만큼 곱해지기 때문이다.
   */
  playHintSeen: "ody:hint-play-seen",
  /**
   * 내가 구독한 데모 봇 목록 (S15P21A405-536). 봇 계정은 서버에 없어서 구독 관계를 보낼 곳이
   * 없다 — 이 브라우저에만 남는다.
   */
  botFollowing: "ody:bot-following",
  /**
   * 새로고침 너머로 들고 가는 쿼리 캐시 (S15P21A405-504). 내 정보·프로필·내 플리 등
   * **지난 값을 먼저 보여 줘도 되는 것**만 들어간다. 넣고 빼는 쪽은 [`query-persist`](../lib/query-persist.ts).
   */
  queryCache: "ody:query-cache",
} as const;
