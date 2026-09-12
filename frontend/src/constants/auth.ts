/**
 * 로그인 게이트 (AUTH-02).
 *
 * **유저 테스트 동안 꺼 둔다.** 로그인을 태우지 않기로 했고(docs/rules/BACKEND-NOTES.md A-17),
 * 백엔드도 그에 맞춰 인증을 한시 해제해 배포했다. 프론트만 게이트를 들고 있으면 테스터가
 * 로그인 화면에서 막히는데, 로그인은 아직 목이라 계정을 만들 수도 없다.
 *
 * **되돌리는 시점은 A-17 과 같다** — 유저 테스트 종료, 또는 로그인 실연동이 붙는 시점 중 먼저 오는 쪽.
 * 그때 이 상수를 지우고 `AuthGuard` 를 원래대로 되돌린다.
 *
 * 로그인·가입 화면을 손볼 때는 `NEXT_PUBLIC_REQUIRE_LOGIN=1` 로 다시 켠다.
 */
export const SKIP_LOGIN = process.env.NEXT_PUBLIC_REQUIRE_LOGIN !== "1";
