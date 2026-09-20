import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { PlayRequest, PlayResponse } from "@/types";

/**
 * 재생 선언 (S15P21A405-482, 실시간 작업명세 §4.1) — **실연동**.
 *
 * 곡 ID 를 본문으로 받는다(경로에 없다). 예전 `/bff/music/{id}/play` 와 모양이 다르다.
 *
 * 호출자의 토큰은 `backendFetch` 가 알아서 넘긴다 (S15P21A405-481) — 이 호출은 **누가**
 * 재생했는지가 곧 내용이라, 서비스 토큰으로 부르면 전원이 한 사람 자리에 모인다.
 */
export async function POST(req: Request) {
  const upstream = "/api/music/play";
  try {
    const body = (await req.json()) as PlayRequest;
    return okLive(await backendPost<PlayResponse>(upstream, body), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(code(err.status), err.message, err.status || 502, upstream);
  }
}

/** 실시간 오류 코드로 옮긴다 (§7.2). 422 는 presence 가 아직 준비되지 않았다는 뜻이다 */
const code = (status: number) => (status === 422 ? "PRESENCE_ERROR" : status === 404 ? "MUSIC_NOT_FOUND" : "INTERNAL_ERROR");
