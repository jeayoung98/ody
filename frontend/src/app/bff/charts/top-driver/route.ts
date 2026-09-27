import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError } from "@/lib/backend";
import { TOP_DRIVER } from "@/constants";
import type { UserRankingItem } from "@/types";

/** 백엔드 `RideRankingItem` — `riderCount` 만 이름이 다르다 (프론트는 `score`) */
interface BackendRideRankingItem {
  rank: number;
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  riderCount: number;
}

const toItem = (u: BackendRideRankingItem): UserRankingItem => ({ rank: u.rank, email: u.email, nickname: u.nickname, imageUrl: u.imageUrl, score: u.riderCount });

/**
 * 실시간 탑 버스기사 (SOCIAL-12) — **배포 백엔드 실연동** (S15P21A405-681, 백엔드 S15P21A405-678).
 * 지금 따라오는 사람이 가장 많은 인솔자 top 10. 순서는 서버가 완전히 정해서 주므로 그대로 넘긴다.
 * 아무도 안 태우고 있으면 `[]` 가 정상이다 — 실패를 목으로 대체하지 않는다.
 *
 * **호출자 토큰으로 부른다.** `callerAuth(req)` 를 안 넘겨도 `backendFetch` 가 요청의
 * Authorization 을 그대로 넘긴다 (S15P21A405-481).
 */
export async function GET() {
  const upstream = `/api/realtime/ride/ranking?limit=${TOP_DRIVER.limit}`;
  try {
    const res = await backendGet<BackendRideRankingItem[]>(upstream);
    return okLive(res.map(toItem), upstream);
  } catch (e) {
    const err = e as BackendError;
    /**
     * **상태 코드를 그대로 흘린다.** `lib/api.ts` 가 401 을 보고 토큰을 재발급하는데, 여기서 502 로
     * 뭉개면 토큰이 만료됐을 뿐인데 사용자에게 오류가 보인다.
     * 404 는 `realtime` 프로파일이 꺼진 서버다 — 다른 실패와 갈라 둬야 배포 문제인지 보인다.
     */
    const code = err.status === 401 ? "UNAUTHENTICATED" : err.status === 404 ? "NOT_IMPLEMENTED" : err.status === 400 ? "INVALID_INPUT" : "INTERNAL_ERROR";
    return failLive(code, err.message, err.status || 502, upstream);
  }
}
