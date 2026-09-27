import type { Email, Id, ISODateString } from "./common";
import type { Music } from "./music";
import type { User } from "./user";

/** 피드(마이페이지/상대 프로필) 상단 + 대시보드 응답 */
export interface UserProfile extends User {
  isOnline: boolean;
  /**
   * 서버가 돌리는 상시 접속 계정인가 (S15P21A405-683). 화면에 구분 표시는 하지 않는다 — 팔로워 수를 보정하고
   * 팔로워 목록을 막는 데만 쓴다. ERD에 없음 — 백엔드 확인 필요 (`user.is_bot`). 없으면 false.
   */
  isBot: boolean;
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

/**
 * 랭킹 한 칸 (사람) — 백엔드 `RankedUser` (S15P21A405-448). rank 는 1부터, 동점도 다른 순위.
 * `score` 는 백엔드의 `count` 다 — 종류마다 뜻이 다르다 (발견한 곡 수 / 재생 횟수 / 신고 건수).
 */
export interface UserRankingItem {
  rank: number;
  email: Email;
  nickname: string | null;
  imageUrl: string | null;
  score: number;
}

/**
 * 이번 주 랭킹 — 백엔드 `GET /api/stats/weekly` (S15P21A405-448, S15P21A405-604).
 * 구간은 한국 시간 월요일 00:00 시작, `weekStart` 이상 `weekEnd` 미만. 세 목록을 한 번에 받는다.
 */
export interface WeeklyRanking {
  weekStart: ISODateString;
  weekEnd: ISODateString;
  /** 그 주에 처음 재생된 곡을 많이 찾아낸 사람 */
  discovery: UserRankingItem[];
  /** 그 주에 재생을 많이 한 사람 (같은 곡 반복 포함) */
  explore: UserRankingItem[];
  /** 그 주에 신고를 많이 한 사람 */
  contribution: UserRankingItem[];
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
  isFollowing: boolean;
  /** **로그인 시각이다.** 접속 여부와 다른 값이므로 여기서 접속을 가늠하지 않는다 */
  lastActiveAt: string | null;
  /**
   * 지금 접속해 있는가 (3차 계약 §4, S15P21A405-545). **소켓이 살아 있다**는 뜻이고
   * 창을 닫으면 늦어도 45초 뒤 `false` 가 된다. 실시간을 안 켠 사용자는 접속해 있어도
   * `false` 인데, 그런 사용자는 지도에도 안 보이므로 화면 전체로 보면 앞뒤가 맞는다.
   */
  isOnline: boolean;
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
