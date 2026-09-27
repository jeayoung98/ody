import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { ApiErrorCode } from "@/types";

/**
 * 반응 보내기 (SOCIAL-02, S15P21A405-607) — **실연동**. 백엔드 `POST /api/realtime/reactions`,
 * 본문 `{toEmail, reactionKey}`. 받는 사람 개인 큐로 `REACTION` 이 한 번 나가고 응답 `data` 는 null 이다.
 *
 * **호출자 토큰으로 부른다** — 누가 보냈는지가 곧 내용이다 (`backendFetch` 가 요청의 Authorization 을 넘긴다).
 * 거부 사유는 그대로 올린다 (백엔드 `RealtimeErrorCode`).
 */
const REACTION_CODES = new Set<string>(["REACTION_SELF", "REACTION_NOT_NEARBY", "REACTION_COOLDOWN", "PRESENCE_ERROR"]);

export async function POST(req: Request) {
  const upstream = "/api/realtime/reactions";
  try {
    const body = (await req.json()) as { toEmail: string; reactionKey: string };
    await backendPost<null>(upstream, body, undefined, { allowNullData: true });
    return okLive(null, upstream);
  } catch (e) {
    const err = e as BackendError;
    const code = REACTION_CODES.has(err.code) ? (err.code as ApiErrorCode) : "INTERNAL_ERROR";
    return failLive(code, err.message, err.status || 502, upstream);
  }
}
