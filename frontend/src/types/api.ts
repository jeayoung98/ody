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
  | "SERVICE_UNAVAILABLE";

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
export type BffErrorCode = "NOT_IMPLEMENTED";

export type ApiErrorCode = ImplementedErrorCode | SpecErrorCode | BffErrorCode;

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

/** §0.2 공통 응답 봉투. 반환할 데이터가 없는 API는 data 가 null 이다 */
export type ApiResponse<T> = { success: true; data: T; error: null } | { success: false; data: null; error: ApiErrorBody };
