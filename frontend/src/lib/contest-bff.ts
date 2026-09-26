import { failLive } from "@/lib/api-response";
import type { BackendError } from "@/lib/backend";
import type { ApiErrorCode, Contest, ContestEntry, ContestMatch, ContestTrack } from "@/types";

/**
 * 콘테스트 BFF 라우트 공통 (S15P21A405-640) — 백엔드 `artwork` 응답을 화면 타입으로 옮기고, 오류 코드를 고른다.
 * 백엔드 모양은 `backend/.../artwork/dto/*.java` (origin/backend/dev, 2026-09-23).
 */

export interface BackendArtworkRound {
  roundId: number;
  theme: string;
  startsAt: string;
  endsAt: string;
  voteLimit: number;
  myVotesLeft: number | null;
}

export interface BackendArtworkTrack {
  musicId: number;
  title: string | null;
  artist: string | null;
  x: number;
  y: number;
}

export interface BackendArtworkSummary {
  artworkId: number;
  rank: number | null;
  title: string;
  ownerEmail: string | null;
  /** 작품 주인 닉네임 (S15P21A405-645). user 행이 없으면 백엔드가 null 을 준다 */
  ownerNickname: string | null;
  status: "PENDING" | "SCORED" | "FAILED";
  score: number | null;
  aiComment: string | null;
  failReason: string | null;
  likeCnt: number;
  likedByMe: boolean;
  musicCnt: number;
  createdAt: string;
  rankScore: number | null;
  closed: boolean;
  points: BackendArtworkTrack[] | null;
  /** 리더보드 응답에 아직 없다 — 백엔드 확인 필요 (BACKEND-NOTES A-91, S15P21A405-684) */
  playlistId?: number | null;
}

export interface BackendDrawResponse {
  score: number;
  quality: "HIGH" | "MEDIUM" | "LOW";
  points: BackendArtworkTrack[];
}

export const toRound = (r: BackendArtworkRound): Contest => ({
  roundId: r.roundId,
  theme: r.theme,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  voteLimit: r.voteLimit,
  myVotesLeft: r.myVotesLeft ?? null,
});

export const toTrack = (p: BackendArtworkTrack): ContestTrack => ({ musicId: p.musicId, title: p.title ?? null, artist: p.artist ?? null, x: p.x, y: p.y });

export const toEntry = (s: BackendArtworkSummary): ContestEntry => ({
  artworkId: s.artworkId,
  rank: s.rank ?? null,
  title: s.title,
  ownerEmail: s.ownerEmail ?? null,
  ownerNickname: s.ownerNickname ?? null,
  status: s.status,
  score: s.score ?? null,
  aiComment: s.aiComment ?? null,
  failReason: s.failReason ?? null,
  likeCnt: s.likeCnt,
  likedByMe: s.likedByMe,
  musicCnt: s.musicCnt,
  createdAt: s.createdAt,
  rankScore: s.rankScore ?? null,
  closed: s.closed,
  tracks: (s.points ?? []).map(toTrack),
  playlistId: s.playlistId ?? null,
});

export const toMatch = (d: BackendDrawResponse): ContestMatch => ({ score: d.score, quality: d.quality, tracks: d.points.map(toTrack) });

/**
 * **그대로 올리는 코드.** 사유마다 화면이 할 말이 다르다 — 표를 다 썼는지(409), 내 작품인지(400), 모양이
 * 없는지(400), 플리 이름이 겹치는지(409). 상태 코드로 뭉치면 못 고른다.
 */
const PASS_THROUGH = new Set<string>([
  "ARTWORK_NOT_FOUND",
  "ARTWORK_ROUND_CLOSED",
  "ARTWORK_NOT_FAILED",
  "ARTWORK_RETRY_EXHAUSTED",
  "ARTWORK_DRAWING_DEGENERATE",
  "ARTWORK_VOTE_LIMIT",
  "ARTWORK_VOTE_SELF",
  "PLAYLIST_NAME_DUPLICATED",
  "PLAYLIST_NOT_FOUND",
  "MUSIC_NOT_FOUND",
  "INVALID_INPUT",
  "FORBIDDEN",
]);

export function artworkCode(err: BackendError): ApiErrorCode {
  if (PASS_THROUGH.has(err.code)) return err.code as ApiErrorCode;
  // `backendFetch` 가 401 을 자기 코드로 바꿔 던진다 — 화면에는 로그인 문제로 보여야 한다
  if (err.status === 401) return "UNAUTHENTICATED";
  return "INTERNAL_ERROR";
}

export function artworkFail(e: unknown, upstream: string) {
  const err = e as BackendError;
  return failLive(artworkCode(err), err.message ?? "콘테스트 처리에 실패했습니다.", err.status || 502, upstream);
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
