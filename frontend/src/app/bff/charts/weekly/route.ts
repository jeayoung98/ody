import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, callerAuth } from "@/lib/backend";
import type { UserRankingItem, WeeklyRanking } from "@/types";

const UPSTREAM = "/api/stats/weekly";

/** 백엔드 `RankedUser` — `count` 만 이름이 다르다 (프론트는 `score`) */
interface BackendRankedUser {
  rank: number;
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  count: number;
}

interface BackendWeeklyStatsResponse {
  weekStart: string;
  weekEnd: string;
  discovery: BackendRankedUser[];
  explore: BackendRankedUser[];
  contribution: BackendRankedUser[];
}

const toItem = (u: BackendRankedUser): UserRankingItem => ({ rank: u.rank, email: u.email, nickname: u.nickname, imageUrl: u.imageUrl, score: u.count });

/**
 * 이번 주 랭킹 (SOCIAL-12) — **배포 백엔드 실연동** (S15P21A405-604, 백엔드 S15P21A405-448).
 * 발견왕·탐험왕·기여도 top 10 이 한 응답에 온다. 전체 집계라 파라미터가 없다.
 * 실패를 목으로 대체하지 않는다 — 랭킹이 비어 보이는 것과 백엔드가 죽은 것은 다른 일이다.
 */
export async function GET(req: Request) {
  try {
    const res = await backendGet<BackendWeeklyStatsResponse>(UPSTREAM, { headers: callerAuth(req) });
    const data: WeeklyRanking = {
      weekStart: res.weekStart,
      weekEnd: res.weekEnd,
      discovery: (res.discovery ?? []).map(toItem),
      explore: (res.explore ?? []).map(toItem),
      contribution: (res.contribution ?? []).map(toItem),
    };
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
