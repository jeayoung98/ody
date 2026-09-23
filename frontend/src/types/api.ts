/**
 * 백엔드 공통 응답 규약 (API 명세서 §0.2 ~ §0.5).
 * 모든 응답은 이 봉투에 담겨 오고, `api()` 가 벗겨서 data 만 돌려준다.
 */

/**
 * 실제 백엔드가 구현한 코드 (`backend/.../common/AuthErrorCode.java`, `GlobalErrorCode.java`).
 * 이름이 아래 명세서 목록과 다르다 — 어느 쪽으로 통일할지 확정 전까지 양쪽을 모두 허용한다
 * (BACKEND-NOTES B-10).
 */
export type ImplementedErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_TOKEN"
  | "REFRESH_TOKEN_NOT_FOUND"
  | "REFRESH_TOKEN_MISMATCH"
  | "INVALID_EXCHANGE_CODE"
  | "INVALID_INPUT"
  | "INTERNAL_SERVER_ERROR"
  // 이메일·비밀번호 인증 (S15P21A405-121, backend/dev AuthErrorCode)
  | "EMAIL_ALREADY_EXISTS"
  | "NICKNAME_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "PASSWORD_MISMATCH"
  | "INVALID_PASSWORD_FORMAT"
  | "INVALID_NICKNAME_LENGTH"
  // 실시간 (S15P21A405-482, 실시간 작업명세 §7.2)
  /** 422 — 소켓 미연결 · 첫 배치인데 layer 없음 · 곡 좌표 없음 · 재생 없이 주변 사람 요청 */
  | "PRESENCE_ERROR"
  /** 503 — 주변 사람의 비슷한 곡 계산이 일시적으로 실패했다. **영구 오류가 아니다** */
  // 따라가기 = 탑승 (S15P21A405-530, backend RealtimeErrorCode)
  /**
   * 사유마다 **사용자가 할 일이 다르다.** 잠시 뒤 다시 하면 되는 것(`RIDE_CAPTAIN_INACTIVE`·
   * `RIDE_FULL`)과 아무리 해도 안 되는 것(`RIDE_SELF`)을 한 코드로 뭉치면 안내를 가를 수 없다.
   */
  /** 409 — 따라갈 사람이 곡 위에 없다 */
  | "RIDE_CAPTAIN_INACTIVE"
  /** 400 — 자기 자신을 골랐다 */
  | "RIDE_SELF"
  /** 409 — 이미 누군가를 따라가는 중이다. 갈아타려면 먼저 내려야 한다 */
  | "RIDE_ALREADY_RIDING"
  /** 409 — 줄줄이 따라가기. 나를 따라오는 사람이 있거나 상대가 남을 따라가는 중이다 */
  | "RIDE_CHAIN_FORBIDDEN"
  /** 409 — 자리가 다 찼다 (최대 20명) */
  | "RIDE_FULL"
  /** 409 — 따라가는 중이 아닌데 내리려 했다. **조용히 넘긴다** — 이미 `RIDE_ENDED` 로 끝났을 수 있다 */
  | "RIDE_NOT_RIDING"
  /** 409 — 따라가는 중이라 스스로 할 수 없는 동작이다 */
  | "RIDE_NOT_CAPTAIN"
  /**
   * 409 — 그 사이 상태가 어긋났다 (2차 명세 §3.3). **실제로 온다** (2026-09-22 배포, A-51).
   *
   * 그 사이 다른 사람을 따라가기 시작했거나, 이전 연결에서 만든 탑승이거나, 서 있는 자리가
   * 없는 경우다. **화면을 새로 고치면 풀린다.** 접속 자체가 없는 경우는 여기 오지 않고
   * `PRESENCE_ERROR` 로 따로 나온다 — 둘은 사용자가 할 일이 다르다.
   */
  | "RIDE_STALE";

/** API 명세서 §0.5 목록 */
export type SpecErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "REFRESH_TOKEN_INVALID"
  | "OAUTH_FAILED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "USER_PRIVATE"
  | "MUSIC_NOT_FOUND"
  | "TRACK_NOT_PLAYABLE"
  | "PATH_NOT_FOUND"
  | "PLAYLIST_NOT_FOUND"
  | "PLAYLIST_NAME_DUPLICATED"
  | "ALREADY_FOLLOWING"
  | "SELF_FOLLOW_NOT_ALLOWED"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "INTERNAL_ERROR";

/**
 * BFF 라우트만 내는 코드. 백엔드 목록에는 없다.
 *
 * `NOT_IMPLEMENTED` 는 **배포 API 에 그 기능이 아예 없다**는 뜻이다 (S15P21A405-468). 목으로
 * 성공한 척하면 새로고침 때 사라져서 "저장이 가끔 안 된다" 로 보이므로, 실패를 드러낸다.
 */
export type BffErrorCode =
  | "NOT_IMPLEMENTED"
  /**
   * 별자리 콘테스트 (S15P21A405-602). 지금은 목 라우트만 낸다 — 백엔드가 같은 이름을 쓰기를
   * 제안해 두었다 (BACKEND-NOTES "별자리 콘테스트"). 사유마다 사용자가 할 일이 다르다.
   */
  | "CONTEST_NOT_FOUND"
  | "CONTEST_NOT_OPEN"
  | "CONTEST_ENTRY_NOT_FOUND"
  /** 409 — 회차당 표를 다 썼다. 다른 표를 거두면 다시 줄 수 있다 */
  | "CONTEST_VOTE_LIMIT"
  /** 400 — 내 출품작에 표를 주려 했다 */
  | "CONTEST_VOTE_SELF"
  /** 409 — 재출품 횟수를 다 썼다 */
  | "CONTEST_RESUBMIT_EXHAUSTED";

export type ApiErrorCode = ImplementedErrorCode | SpecErrorCode | BffErrorCode;

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

/** §0.2 공통 응답 봉투. 반환할 데이터가 없는 API는 data 가 null 이다 */
export type ApiResponse<T> = { success: true; data: T; error: null } | { success: false; data: null; error: ApiErrorBody };
