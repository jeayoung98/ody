/**
 * 지금 보여 줄 기능.
 *
 * **전부 켜져 있다** (S15P21A405-480). 예전에는 유저 테스트 동안 마이페이지·플레이리스트·
 * 주변 사람·차트를 감췄고(S15P21A405-333), 설문 모드가 그 스위치였다 — 테스터는 탐색만 보고
 * 팀원은 모드를 꺼서 전부 봤다. 이제 테스트 모드에서도 나머지 기능을 그대로 쓰기로 해서
 * 감추는 축 자체가 없어졌다. **설문 모드가 가르는 것은 설문뿐이다.**
 *
 * 값을 지우지 않고 남겨 둔 이유: 호출부 열 곳이 `features.social` 처럼 이름으로 묻고 있고,
 * 다음에 무언가를 다시 감출 일이 생기면 여기만 false 로 돌리면 된다. 그때도 호출부는 안 고친다.
 *
 * **상수를 직접 import 하지 않는다.** 반드시 [`useFeatures`](../hooks/use-features.ts) 를 거친다 —
 * 다시 모드를 따르게 될 때 훅만 고치면 되도록.
 */
/**
 * 값 타입을 `boolean` 으로 못박는다 — `as const` 로 두면 전부 리터럴 `true` 가 되어,
 * `features.social` 로 갈라 둔 자리가 "항상 참" 으로 좁혀지고 비교문이 타입 오류가 난다
 * (`help-dialog.tsx` 의 `when !== false`). 지금 값이 전부 참인 것은 상태일 뿐 타입이 아니다.
 */
type Features = { profile: boolean; playlist: boolean; social: boolean; chart: boolean; contest: boolean };

export const FEATURES: Features = {
  /** 마이페이지 — 내 프로필 패널, 지도에서 남의 프로필 열기 */
  profile: true,
  /** 플레이리스트 — 패널, 플리에 추가, 곡 상세의 관련 플리, 플리 재생 */
  playlist: true,
  /**
   * 주변 **사람** — 지도 위 사람 표식, 주변 사람 탭, 따라가기, 반응.
   *
   * 주변 **탐색**(곡 이웃, MAP-10)과 헷갈리지 않는다. 그건 별개다.
   */
  social: true,
  /** 차트 — 인기 플리·유저 랭킹 */
  chart: true,
  /** 별자리 콘테스트 — 상단 원형 버튼, 그리기·갤러리·순위 패널 (S15P21A405-602). 아직 전부 목이다 */
  contest: true,
};

/** 지금 열 수 있는 패널인가. 숨긴 기능의 패널은 프로그램으로 열려도 렌더하지 않는다 */
const panelsFor = (f: typeof FEATURES): Record<string, boolean> => ({
  song: true,
  journey: true,
  feed: f.profile,
  playlist: f.playlist,
  friends: f.social,
  chart: f.chart,
  contest: f.contest,
});

/**
 * 미리 만들어 둔다 — 훅이 매 렌더 새 객체를 돌려주면 `useSyncExternalStore` 가 스냅샷이
 * 계속 바뀐 것으로 보고 무한 렌더에 빠진다.
 */
export const PANEL_ENABLED = panelsFor(FEATURES);

/**
 * 설문 모드에서 보여 줄 기능 — **랭킹만 뺀다** (S15P21A405-570).
 *
 * 테스터에게 물어보는 것은 탐색이라 랭킹 탭이 자리만 차지한다. 다시 기능 표시를 가르는
 * 축이 생긴 셈인데, 예전(S15P21A405-333)처럼 네 기능을 통째로 감추던 것과는 범위가 다르다 —
 * 나머지는 설문 모드에서도 그대로 쓴다.
 */
export const SURVEY_FEATURES: Features = { ...FEATURES, chart: false, contest: false };

/** {@link PANEL_ENABLED} 와 같은 이유로 미리 만든다 */
export const SURVEY_PANEL_ENABLED = panelsFor(SURVEY_FEATURES);
