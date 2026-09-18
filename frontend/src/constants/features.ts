/**
 * 유저 테스트 동안 **잠깐 감춰 두는 기능** (S15P21A405-333).
 *
 * 로그인 게이트와 **세트**다 (`auth-guard` 의 `useSkipLogin`) — 둘 다 설문 모드를 따른다.
 * 이번 테스트에서 볼 것은 탐색 · 주변 탐색 · 검색 · 여정 네 가지이고, 나머지는 아직 목이거나
 * 실연동이 덜 끝났다. 열려 있으면 피드백이 그쪽으로 쏠린다.
 *
 * **기능을 지우지 않는다.** 들어가는 입구만 닫는다 — 패널·훅·API 라우트는 그대로 살아 있고,
 * 되돌릴 때는 환경변수만 켜면 된다. 원복 시점은 로그인 게이트와 같다 (유저 테스트 종료).
 *
 * ```sh
 * # .env.local — 켜고 싶은 것만
 * NEXT_PUBLIC_FEATURE_PROFILE=1
 * NEXT_PUBLIC_FEATURE_PLAYLIST=1
 * NEXT_PUBLIC_FEATURE_SOCIAL=1
 * NEXT_PUBLIC_FEATURE_CHART=1
 * ```
 *
 * `process.env.NEXT_PUBLIC_*` 는 Next 가 **빌드 시각에 문자열로 박아 넣는다.** 그래서 이 값은
 * "설문 모드일 때 낱낱이 켜 보는" 개발자용 스위치다 — 배포본에서는 못 바꾼다.
 *
 * **배포본에서 통째로 되돌리는 길은 따로 있다** (S15P21A405-387). 설문 모드를 끄면
 * [`useFeatures`](../hooks/use-features.ts) 가 아래 `ALL_FEATURES` 로 갈아탄다.
 * 여기 상수는 **설문 모드일 때의 값**이고, 훅을 거치지 않고 직접 읽으면 모드를 안 따른다.
 */
const on = (v: string | undefined) => v === "1";

export const FEATURES = {
  /** 마이페이지 — 내 프로필 패널, 지도에서 남의 프로필 열기 */
  profile: on(process.env.NEXT_PUBLIC_FEATURE_PROFILE),
  /** 플레이리스트 — 패널, 플리에 추가, 곡 상세의 관련 플리, 플리 재생 */
  playlist: on(process.env.NEXT_PUBLIC_FEATURE_PLAYLIST),
  /**
   * 주변 **사람** — 지도 위 사람 표식, 주변 사람 탭, 따라가기, 반응.
   *
   * 주변 **탐색**(곡 이웃, MAP-10)과 헷갈리지 않는다. 그건 남긴다.
   */
  social: on(process.env.NEXT_PUBLIC_FEATURE_SOCIAL),
  /** 차트 — 인기 플리·유저 랭킹 */
  chart: on(process.env.NEXT_PUBLIC_FEATURE_CHART),
} as const;

/** 설문 모드를 끄면 감춘 것이 전부 돌아온다 — 개발 중에는 원래 앱을 봐야 한다 */
export const ALL_FEATURES: typeof FEATURES = { profile: true, playlist: true, social: true, chart: true };

/** 지금 열 수 있는 패널인가. 숨긴 기능의 패널은 프로그램으로 열려도 렌더하지 않는다 */
const panelsFor = (f: typeof FEATURES): Record<string, boolean> => ({
  song: true,
  journey: true,
  feed: f.profile,
  playlist: f.playlist,
  friends: f.social,
  chart: f.chart,
});

/**
 * 미리 만들어 둔다 — 훅이 매 렌더 새 객체를 돌려주면 `useSyncExternalStore` 가 스냅샷이
 * 계속 바뀐 것으로 보고 무한 렌더에 빠진다.
 */
export const PANEL_ENABLED = panelsFor(FEATURES);
export const ALL_PANELS = panelsFor(ALL_FEATURES);
