/**
 * 지금 보여 줄 기능.
 *
 * **전부 켜져 있다** (S15P21A405-480). 예전에는 유저 테스트 동안 마이페이지·플레이리스트·
 * 주변 사람·차트를 감췄고(S15P21A405-333), 설문 모드가 그 스위치였다 — 테스터는 탐색만 보고
 * 팀원은 모드를 꺼서 전부 봤다. 이제 테스트 모드에서도 나머지 기능을 그대로 쓰기로 해서
 * 감추는 축 자체가 없어졌다. **설문 모드가 가르는 것은 설문뿐이다.** 한때 랭킹만 다시 감췄다가
 * (S15P21A405-570) 콘테스트까지 딸려 꺼지는 바람에 그 축도 걷어냈다 (S15P21A405-612).
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
type Features = { profile: boolean; playlist: boolean; social: boolean; chart: boolean; contest: boolean; playHint: boolean };

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
  /** 이벤트(별자리 콘테스트) — 상단 원형 버튼이 여는 전체 화면 모달 (S15P21A405-602). 우측 패널이 아니라 `PANEL_ENABLED` 에는 없다. 아직 전부 목이다 */
  contest: true,
  /**
   * 바로재생 안내 — **지금은 꺼 둔다** (S15P21A405-636).
   *
   * "별을 더블클릭하면 바로 재생돼요" 를 문맥(지도·주변 탐색·여정)마다 한 번 짚어 주는
   * 자리다 (`components/discovery/play-hint.tsx`, S15P21A405-393). 튜토리얼과 **다른 물건**인데
   * 덤과 반짝임 고리까지 모양을 일부러 같게 만들어 둔 터라, 화면에서는 튜토리얼이 한 번 더
   * 뚫고 나온 것처럼 읽힌다.
   *
   * **걷어낸 것이 아니라 내려 둔 것이다.** 컴포넌트도 문구도 저장소 키(`playHintSeen`)도
   * 그대로 있어서, 이 한 줄을 `true` 로 되돌리면 예전 그대로 돈다.
   *
   * 안내만 안 뜨고 **동작은 살아 있다** — 이미 고른 별을 다시 누르면 재생되는 지도의 클릭
   * 문법(S15P21A405-288)은 이 스위치와 상관이 없다.
   */
  playHint: false,
};

/** 지금 열 수 있는 패널인가. 숨긴 기능의 패널은 프로그램으로 열려도 렌더하지 않는다 */
const panelsFor = (f: typeof FEATURES): Record<string, boolean> => ({
  song: true,
  journey: true,
  feed: f.profile,
  playlist: f.playlist,
  friends: f.social,
  chart: f.chart,
});

/** 미리 만들어 둔다 — 훅이 매 렌더 새 객체를 돌려주면 그걸 의존성으로 쓰는 쪽이 매번 다시 돈다 */
export const PANEL_ENABLED = panelsFor(FEATURES);

