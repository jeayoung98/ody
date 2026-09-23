import type { Email, Id, ISODateString } from "./common";

/**
 * 별자리 콘테스트 = 백엔드의 **작품(artwork)** 도메인 (S15P21A405-640).
 *
 * 602 에서 목으로 먼저 붙였던 계약(A-62~A-70)은 폐기했고, 이 파일은 2026-09-23 `origin/backend/dev` 의
 * `backend/.../artwork/dto/*.java` 를 읽어 옮긴 것이다 (BACKEND-NOTES §6·§6-8·§6-9, S15P21A405-563·598·616).
 *
 * 목과 달라진 것: 회차에 `status`·`roundNo`·`announceAt`·규칙 묶음이 없다(기간만 온다). **즉시 심사가 없다** —
 * AI 채점은 출품 뒤 서버가 비동기로 하고, 화면은 내 작품 상태(`PENDING`→`SCORED`/`FAILED`)를 다시 읽는다.
 * AI 게이트·최종점수 식·저장 수·재출품 횟수 제한도 없다.
 */

/** 회차 (`ArtworkRound`). 열려 있는지는 `startsAt`~`endsAt` 로 화면이 판단한다 (`lib/contest-view`) */
export interface Contest {
  roundId: Id;
  /** 테마 한 단어 (예: 고양이). 채점 기준 문장은 내려오지 않는다 — 그대로 맞추는 것이 최적 전략이 되기 때문 */
  theme: string;
  startsAt: ISODateString;
  endsAt: ISODateString;
  /** 회차당 남의 작품에 줄 수 있는 좋아요 수 (S15P21A405-616) */
  voteLimit: number;
  /** 남은 좋아요. 비로그인이면 `null` */
  myVotesLeft: number | null;
}

/** 캔버스 입력 점. 0~1 정규화, **y 는 아래가 양수**(화면 좌표). 클릭 위치 ÷ 캔버스 크기 그대로 */
export interface SketchPoint {
  x: number;
  y: number;
}

/**
 * 별자리의 한 점과 그 곡 (`ArtworkTrack`). 좌표 규약은 `ConstellationPoint` 와 같다 — -1~1, **y 는 위가 양수**.
 * `title` 은 곡이 지워졌으면 `null` 이다 — 원소는 남고 이름만 빈다(그림이 깨지지 않는 것이 우선).
 */
export interface ContestTrack {
  musicId: Id;
  title: string | null;
  artist: string | null;
  x: number;
  y: number;
}

/** 그린 모양과 찾은 배치가 얼마나 닮았나 (`DrawResponse.quality`). `LOW` 도 정상 응답이다 — 경고만 띄운다 */
export type MatchQuality = "HIGH" | "MEDIUM" | "LOW";

/** `POST /api/artwork/draw` 결과. **AI 채점이 아니다** — 모양 일치도다 */
export interface ContestMatch {
  /** 모양 일치도 0~100. 이동·회전·확대 불변, 좌우 반전은 다른 모양 */
  score: number;
  quality: MatchQuality;
  /** 점 입력 순서와 같은 순서. 곡 중복 없음 */
  tracks: ContestTrack[];
}

/**
 * 작품 평가 상태 (`ArtworkStatus`). `FAILED` 는 `score` 가 **`null`** 이다 — 0 이 아니다.
 * 리더보드에는 `SCORED` 만 선다. 내 작품(`/mine`)은 모든 상태가 온다.
 */
export type ArtworkStatus = "PENDING" | "SCORED" | "FAILED";

/** 목록 한 줄 (`ArtworkSummary`). 리더보드와 내 작품이 같은 모양이다 */
export interface ContestEntry {
  artworkId: Id;
  /** 리더보드에서만. 내 작품 목록은 `null` */
  rank: number | null;
  title: string;
  ownerEmail: Email | null;
  status: ArtworkStatus;
  /** AI 점수 0~100. 평가 전·실패면 `null` */
  score: number | null;
  aiComment: string | null;
  /** 실패 사유. 소유자에게만 채워진다 */
  failReason: string | null;
  likeCnt: number;
  likedByMe: boolean;
  musicCnt: number;
  createdAt: ISODateString;
  /** 순위 점수 = 좋아요 + AI ÷ 100 × K (K 회차별, 기본 5). 리더보드에서만 */
  rankScore: number | null;
  /** 마지막 곡 → 첫 곡을 잇는가 */
  closed: boolean;
  /** 별자리 좌표 + 곡 이름, 출품 순서 (백엔드 `points`). 내 작품 목록은 빈 배열 */
  tracks: ContestTrack[];
}

export interface ContestLeaderboard {
  round: Contest;
  /** 순위순 (`rankScore` ↓ → `score` ↓ → 먼저 낸 순). 갤러리 정렬은 화면이 이 안에서 다시 한다 */
  items: ContestEntry[];
  page: number;
  size: number;
  totalCnt: number;
}

/** 출품 결과. `status` 는 언제나 `PENDING` — 점수는 `/mine` 을 다시 읽어야 보인다 */
export interface ContestSubmitResult {
  artworkId: Id;
  status: ArtworkStatus;
  /** 출품하려고 만든 플레이리스트 */
  playlistId: Id;
}

export interface ContestLikeResult {
  artworkId: Id;
  liked: boolean;
  /** 변경 후 값 */
  likeCnt: number;
}

/** 갤러리 정렬. 서버는 순위순 하나만 주므로 나머지는 받아 온 페이지 안에서 화면이 정렬한다 */
export type ContestSort = "rank" | "latest" | "likes" | "ai";
