import { failLive, okLive } from "@/lib/api-response";
import { backendGet, backendPost, BackendError } from "@/lib/backend";
import type { ApiErrorCode, TasteAnalysis } from "@/types";

/**
 * 음악 취향 분석 (S15P21A405-630) — **실연동**. 백엔드 `GET·POST /api/taste-analysis`
 * (S15P21A405-512, MR !426).
 *
 * **호출자 토큰으로 부른다.** 백엔드가 `Authentication` 으로 사람을 정하므로 서비스 토큰으로
 * 부르면 전부 한 사람의 취향이 된다 — `backendFetch` 가 요청의 Authorization 을 그대로 넘긴다.
 *
 * `/api/` 로 직접 부르지 않는 이유는 다른 실연동 경로와 같다: 로컬에서 rewrite 가 브라우저의
 * `Origin` 을 실어 보내 백엔드가 `403 Invalid CORS request` 로 막는다 (S15P21A405-303).
 */

/**
 * 취향 분석 전용 코드를 **그대로 올린다** (백엔드 `TasteErrorCode`).
 *
 * 상태 코드로 뭉치면 화면이 할 말을 못 고른다 — 사용자가 할 일이 넷 다 다르다: 곡을 더
 * 좋아요하거나(422), 내일 다시 오거나(429), 기다리거나(409), 우리가 할 수 있는 게 없거나(503).
 */
const TASTE_CODES = new Set<string>([
  "TASTE_INSUFFICIENT_SAMPLE",
  "TASTE_DAILY_LIMIT",
  "TASTE_ANALYSIS_IN_PROGRESS",
  "TASTE_REFERENCE_UNAVAILABLE",
]);

function tasteCode(code: string): ApiErrorCode {
  return TASTE_CODES.has(code) ? (code as ApiErrorCode) : "INTERNAL_ERROR";
}

const UPSTREAM = "/api/taste-analysis";

/** 지금 상태와 만들어 둔 리포트. 아무것도 안 만들었어도 분포와 자격은 온다 */
export async function GET() {
  try {
    return okLive(await backendGet<TasteAnalysis>(UPSTREAM), UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive(tasteCode(err.code), err.message, err.status || 502, UPSTREAM);
  }
}

/**
 * 리포트를 새로 만든다. **본문이 없다** — 누구 것인지는 토큰이 말한다.
 *
 * 그래도 `{}` 를 보낸다. `backendPost` 가 `Content-Type: application/json` 을 붙이는데 본문이
 * 비면 그 헤더와 어긋나고, 빈 본문을 파싱하려다 400 을 내는 서버가 있다.
 */
export async function POST() {
  try {
    return okLive(await backendPost<TasteAnalysis>(UPSTREAM, {}), UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive(tasteCode(err.code), err.message, err.status || 502, UPSTREAM);
  }
}
