import { failLive, ok, okLive } from "@/lib/api-response";
import { backendGet, BackendError, isBackendEnabled, type BackendMusicDetail } from "@/lib/backend";
import { mockSearch } from "@/mocks/music";
import type { MusicSearchResult } from "@/types";

/** `/api/music/search` 응답 — 정본 §0.3 페이지 래퍼 */
interface BackendSearchResponse {
  content: BackendMusicDetail[];
}

/**
 * GET /api/music/search?q=<키워드>
 *
 * 백엔드는 파라미터 이름이 `query` 이고 0-based `page` 를 요구한다. 화면은 한 페이지만 쓰므로
 * 여기서 이름을 맞추고 page=0 을 붙인다.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return ok([]);

  if (!isBackendEnabled()) return ok(mockSearch(q));

  const upstream = `/api/music/search?query=${encodeURIComponent(q)}&page=0`;
  try {
    const res = await backendGet<BackendSearchResponse>(upstream);
    const results: MusicSearchResult[] = res.content.map((m) => ({ id: m.id, title: m.title, artist: m.artist }));
    return okLive(results, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
