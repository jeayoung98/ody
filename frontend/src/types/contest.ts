import type { Email, Id, ISODateString } from "./common";

/**
 * 별자리 콘테스트 (S15P21A405-602). **ERD 에 없는 도메인이다 — 전부 백엔드 확인 필요.**
 * 백엔드 설계 이슈: S15P21A405-548 (AI 평가·리더보드), S15P21A405-598 (그린 점 → 곡 매칭).
 * 계약 초안은 docs/rules/BACKEND-NOTES.md "별자리 콘테스트" 절에 있다.
 */
export type ContestStatus = "OPEN" | "CLOSED" | "ANNOUNCED";

/** 회차별로 바뀔 수 있는 규칙 값. 프론트가 박아 두지 않고 서버에서 받는다 */
export interface ContestRules {
  /** 캔버스에 찍는 점 개수 범위 (S15P21A405-598: 3~20) */
  minPoints: number;
  maxPoints: number;
  /** 회차당 다시 출품할 수 있는 횟수 */
  resubmitLimit: number;
  /** 회차당 한 사람이 줄 수 있는 표 */
  voteLimit: number;
  /** 이 점수 미만은 갤러리에 남되 순위에서 빠진다 */
  aiGate: number;
  /** 별자리 이름 최대 글자 수 */
  titleMax: number;
}

export interface Contest {
  id: Id;
  roundNo: number;
  /** 테마 한 단어 (예: 고양이) */
  theme: string;
  startsAt: ISODateString;
  endsAt: ISODateString;
  announceAt: ISODateString;
  status: ContestStatus;
  rules: ContestRules;
  /** 내 출품작. 없으면 null */
  myEntryId: Id | null;
  myVotesLeft: number;
  myResubmitsLeft: number;
}

/** 캔버스 입력 점. 0~1 정규화, **y 는 아래가 양수**(화면 좌표) */
export interface SketchPoint {
  x: number;
  y: number;
}

/**
 * 매칭된 곡 하나와 그 배치 좌표. 좌표 규약은 `ConstellationPoint` 와 같다 —
 * -1~1, **y 는 위가 양수** (S15P21A405-598 AC: 결과 좌표가 별자리 배치 API 와 일치한다)
 */
export interface ContestTrack {
  musicId: Id;
  title: string;
  artist: string | null;
  x: number;
  y: number;
}

/** 그린 모양과 찾은 곡 배치가 얼마나 닮았나 (S15P21A405-598) */
export type MatchQuality = "HIGH" | "MID" | "LOW";

export interface ContestMatch {
  /** 점 입력 순서와 같은 순서. 중복 없음 */
  tracks: ContestTrack[];
  /** 0~1 */
  similarity: number;
  quality: MatchQuality;
}

/** AI 심사 결과 (S15P21A405-548). 모양만 보고 매긴다 — 곡·사용자 정보는 입력에 없다 */
export interface ContestJudge {
  /** 0~100 */
  score: number;
  /** 한 줄 평 */
  comment: string;
}

export interface ContestEntry {
  id: Id;
  contestId: Id;
  title: string;
  ownerEmail: Email | null;
  ownerNickname: string | null;
  /** 출품 시점 **스냅샷**. 원본 플리를 고쳐도 바뀌지 않는다 */
  tracks: ContestTrack[];
  /** 마지막 곡 → 첫 곡을 잇는가 */
  closed: boolean;
  /** 심사 전·실패면 null ("심사 대기") */
  aiScore: number | null;
  aiComment: string | null;
  voteCount: number;
  /** 내 플리로 가져간 사람 수 */
  saveCount: number;
  /** AI×0.5 + (표 ÷ 1위 표 × 100)×0.5. 순위 대상이 아니면 null */
  finalScore: number | null;
  /** aiScore ≥ rules.aiGate */
  eligible: boolean;
  /** 순위 대상 안에서의 순번. 제외면 null */
  rank: number | null;
  votedByMe: boolean;
  savedByMe: boolean;
  isMine: boolean;
  createdAt: ISODateString;
}

export type ContestSort = "latest" | "votes" | "ai" | "final" | "saves";
