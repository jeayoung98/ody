import type { Email, Id, ISODateString } from "./common";

/** refresh_token 테이블 — 서버 측 엔티티. 프론트에서는 참고용 */
export interface RefreshToken {
  id: Id;
  email: Email;
  /** 리프레시 토큰 SHA-256 hex(64자) */
  tokenHash: string;
  /** 디바이스 식별자, 멀티 세션 구분 */
  deviceId: string;
  /** 리프레시 토큰 만료 */
  expiresAt: ISODateString;
  createdAt: ISODateString;
  /** 갱신 시각 */
  updatedAt: ISODateString;
}
