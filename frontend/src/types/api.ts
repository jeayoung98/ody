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
  | "INVALID_NICKNAME_LENGTH";

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

export type ApiErrorCode = ImplementedErrorCode | SpecErrorCode;

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

/** §0.2 공통 응답 봉투. 반환할 데이터가 없는 API는 data 가 null 이다 */
export type ApiResponse<T> = { success: true; data: T; error: null } | { success: false; data: null; error: ApiErrorBody };
