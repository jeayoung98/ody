/**
 * 구글 OAuth 클라이언트 ID 의 기본값 (AUTH-01/02).
 *
 * **비밀값이 아니다.** 브라우저 번들에 문자열로 그대로 실리고, 구글 로그인은 이 값이 공개라는
 * 전제로 설계돼 있다. `.env.example` 에도 같은 값이 적혀 있다.
 */
const DEFAULT_GOOGLE_CLIENT_ID = "602769818964-nt9s5tgu7u89cdvq7t0couihdf6floab.apps.googleusercontent.com";

/**
 * 환경변수가 있으면 그것, 없으면 기본값 (S15P21A405-486).
 *
 * **빈 문자열도 "없음" 으로 본다.** `NEXT_PUBLIC_*` 이 정의되지 않았을 때 번들에 `undefined`
 * 로 박히는지 `""` 로 박히는지에 기대지 않기 위해서다 — 둘 중 하나로 갈리면 배포본만 조용히
 * 빈 값이 되는데, 그게 바로 이 이슈에서 고치는 증상이다.
 *
 * 순수 함수로 빼 둔 것은 **시험할 수 있게** 하기 위해서다 (`lib/backend.ts` 의 `authHeader` 와 같은 이유).
 * 모듈 최상위에서 한 번 계산되는 값이라, 함수로 빼지 않으면 환경변수별 동작을 테스트에서 재현할 수 없다.
 */
export function resolveGoogleClientId(fromEnv: string | undefined): string {
  return fromEnv || DEFAULT_GOOGLE_CLIENT_ID;
}

/**
 * 구글 로그인에 쓰는 클라이언트 ID.
 *
 * **기본값을 코드에 두는 이유는 배포다.** `NEXT_PUBLIC_*` 은 **빌드 시각에** 번들에 박히는
 * 값인데, `frontend/Jenkinsfile` 의 빌드 단계는 도커 컨테이너에 `VITE_API_BASE_URL` 하나만
 * 넘긴다. 그래서 배포본은 늘 빈 값이었고 로그인 화면에 "구글 로그인이 설정되지 않았습니다"
 * 가 떴다. **배포 서버에 나중에 환경변수를 넣어도 소용없다** — 빌드가 이미 끝났기 때문이다.
 * `lib/backend.ts` 의 `BACKEND_ORIGIN` 이 같은 이유로 코드 기본값을 들고 있다.
 *
 * **이 값만으로는 부족하다.** 둘 다 저장소 밖이고, 하나라도 어긋나면 버튼은 떠도 눌렀을 때 막힌다:
 *  - 쓰려는 오리진이 Google Cloud Console 의 그 클라이언트에 '승인된 JavaScript 원본' 이어야 한다
 *  - 백엔드가 idToken audience 검증에 **같은** 클라이언트 ID 를 써야 한다
 */
export const GOOGLE_CLIENT_ID = resolveGoogleClientId(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
