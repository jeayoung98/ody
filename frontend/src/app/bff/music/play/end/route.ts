import { failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError } from "@/lib/backend";
import type { PlayEndRequest } from "@/types";

/**
 * 재생 종료 (S15P21A405-482, 실시간 작업명세 §4.2) — **실연동**.
 * 위치는 바뀌지 않는다. 들은 시간만 남긴다.
 */
export async function PATCH(req: Request) {
  const upstream = "/api/music/play/end";
  try {
    const body = (await req.json()) as PlayEndRequest;
    await backendPatch<null>(upstream, body);
    return okLive(null, upstream);
  } catch (e) {
    const err = e as BackendError;
    // 403 은 내 기록이 아니거나 없는 playHistoryId 다 (§7.2)
    return failLive(err.status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
