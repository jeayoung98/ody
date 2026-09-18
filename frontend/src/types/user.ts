import type { Email, Id, ISODateString } from "./common";

/** user 테이블 — PK는 구글 계정 이메일 */
export interface User {
  /** PK, 구글 계정 이메일 */
  email: Email;
  /** 구글 표시명 */
  name: string | null;
  /** 온보딩에서 설정, 2~20자 */
  nickname: string | null;
  /** 공개 계정 여부, 비공개면 따라가기 불가 */
  isPublic: boolean;
  /** 튜토리얼 완료 여부 */
  tutorialCompleted: boolean;
  /** 최근 활동 시각 */
  lastActiveAt: ISODateString | null;
  /** 가입 시각 */
  createdAt: ISODateString;
  /** 수정 시각. **배포 백엔드는 내려주지 않는다** (`UserDetailResponse` 에 없다) */
  updatedAt: ISODateString | null;
  /** 프로필 이미지 URL */
  imageUrl: string | null;
}

/** follow 테이블 */
export interface Follow {
  /** 팔로우 ID */
  id: Id;
  /** users.email, 팔로우를 하는 쪽 */
  followerEmail: Email;
  /** users.email, 팔로우를 받는 쪽 */
  followeeEmail: Email;
  /** 팔로우 시각 */
  createdAt: ISODateString;
}

/** meeting 테이블 — 두 유저의 누적 만남 횟수. (user1, user2) 복합 PK */
export interface Meeting {
  /** users.email, 사전순 앞 */
  user1: Email;
  /** users.email, 사전순 뒤 */
  user2: Email;
  /** 누적 만남 횟수 */
  cnt: number;
}
