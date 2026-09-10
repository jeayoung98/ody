/** ISO 8601 문자열 (TIMESTAMPTZ 직렬화 결과, 예: "2026-09-08T04:39:28.839Z") */
export type ISODateString = string;

/** BIGINT PK. JSON 직렬화 시 number로 내려온다고 가정 */
export type Id = number;

/** users.email — user 테이블의 PK로 여러 테이블에서 FK로 사용됨 */
export type Email = string;

/**
 * 페이지네이션 응답 공통 래퍼 (API 명세서 §0.3).
 * 요청은 0-based `page` 하나만 보낸다 — 페이지 크기는 서버가 10으로 고정하며,
 * `size` 는 클라이언트가 값을 하드코딩하지 않도록 내려주는 참고값이다.
 */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}
