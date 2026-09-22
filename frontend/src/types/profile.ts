import type { Email, Id, ISODateString } from "./common";
import type { Music } from "./music";
import type { User } from "./user";

/** 피드(마이페이지/상대 프로필) 상단 + 대시보드 응답 */
export interface UserProfile extends User {
  isOnline: boolean;
  followerCount: number;
  followingCount: number;
  /** 가입 후 며칠째인지 */
  daysSinceJoined: number;
  /** 지금 재생 중인 곡 */
  nowPlaying: Pick<Music, "id" | "title" | "artist"> | null;
  /** 상대 프로필일 때만: 나와 만난 횟수 */
  meetingCount: number | null;
  /** 내가 이 사람을 따라가고 있는지 */
  isFollowing: boolean;
  /** 이 사람이 따라가고 있는 사람 (있으면) */
  followingTarget: Pick<User, "email" | "nickname"> | null;
  dashboard: ProfileDashboard;
}

export interface ProfileDashboard {
  /**
   * 탐험한 곡 수 (재생 누른 곡). **`null` 은 모른다는 뜻이고 0 과 다르다** (S15P21A405-531) —
   * 화면은 null 이면 그 줄을 그리지 않는다.
   */
  exploredCount: number | null;
  /** 발견한 곡 수 (처음 재생한 곡). 배포 API 에 아직 없어 늘 null 이다 */
  discoveredCount: number | null;
  /** 선호 분위기 퍼센티지 */
  moodPreference: { mood: string; percent: number }[];
}

/** 주변 친구 (지도 위 헬멧/우주선 + 목록 항목) */
export interface NearbyUser {
  email: Email;
  nickname: string | null;
  imageUrl: string | null;
  isOnline: boolean;
  isPublic: boolean;
  /** 지금 듣고 있는 곡 = 지도상 위치 (따라가기 시 우주선·내 위치의 기준) */
  musicId: Id;
  /** 지금 보고 있는 상세 곡 (클릭한 곡). 따라가기 시 뷰포트 이동과 우측 패널의 기준 (SOCIAL-07) */
  viewingMusicId: Id;
  /** 선호 장르 (헬멧 색) */
  genreId: Id;
  /** 나와 만난 횟수 */
  meetingCount: number;
  /** 이 사람을 따라가는 인원 수. 1명 이상이면 우주선으로 그린다 */
  riderCount: number;
  /** 따라가기 중이면 대상 닉네임 */
  followingNickname: string | null;
  /** 절차적 아바타 시드 (0~1 여섯 개) */
  avatarSeed: number[];
  /**
   * 서버가 준 원시 PC 좌표 (S15P21A405-482). **ERD 에 없다** — 실시간 뷰포트 전용이다.
   *
   * 그 사람의 곡이 이 겹 상주 집합에 있으면 엔진이 그 별 자리를 쓰고, 없을 때 이 값으로
   * 찍는다. 목 시절에는 없으면 이메일 해시로 아무 별에나 붙였는데, 그건 **엉뚱한 자리**였다.
   */
  x?: number;
  y?: number;
}

/** 랭킹 항목 (사람) */
export interface UserRankingItem {
  rank: number;
  email: Email;
  nickname: string | null;
  imageUrl: string | null;
  /** 지표값 (팔로워 수, 탐험 곡 수 등) */
  score: number;
}

/** 랭킹 항목 (플레이리스트) */
export interface PlaylistRankingItem {
  rank: number;
  playlistId: Id;
  playlistName: string;
  ownerNickname: string | null;
  likeCnt: number;
}

/** 반응 이벤트 (수신) */
export interface ReactionEvent {
  id: string;
  fromEmail: Email;
  reactionKey: string;
  sentAt: ISODateString;
}

/**
 * 팔로우 등록·해제 응답 (S15P21A405-489, BACKEND-NOTES A-37·A-38).
 * `followeeFollowerCnt` 는 **바뀐 뒤** 값이라 화면이 다시 조회하지 않고 바로 쓴다.
 */
export interface FollowResponse {
  followerEmail: string;
  followeeEmail: string;
  isFollowing: boolean;
  followeeFollowerCnt: number;
}

/**
 * 팔로워·팔로잉 목록의 한 사람 (A-39).
 *
 * `isFollowing` 과 `meetingCnt` 는 목록 소유자가 아니라 **토큰 주체 기준**이다 — 남의 팔로잉
 * 목록을 봐도 "내가" 그 사람을 구독 중인지가 온다.
 */
export interface FollowUserSummary {
  email: string;
  name: string | null;
  nickname: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  isFollowing: boolean;
  lastActiveAt: string | null;
  /** ⚠️ 정본 명세에 없는 추가 필드 — 기획 확인 대기 (A-39) */
  meetingCnt: number;
}

/** `totalElements`·`totalPages` 가 없다 — 공통 래퍼 결정과 같다 (S15P21A405-255) */
export interface FollowListResponse {
  type: "follower" | "following";
  content: FollowUserSummary[];
  page: number;
  size: number;
  hasNext: boolean;
}
