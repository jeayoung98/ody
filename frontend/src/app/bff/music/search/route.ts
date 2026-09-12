import { failLive, ok, okLive } from "@/lib/api-response";
import { backendGet, BackendError, isBackendEnabled, type BackendMusicDetail } from "@/lib/backend";
import { SEARCH_PAGE_SIZE } from "@/constants";
import { mockSearch } from "@/mocks/music";
import type { MusicSearchPage } from "@/types";

/**
 * `/api/music/search` 응답 — 정본 §0.3 페이지 래퍼.
 * 전체 건수는 오지 않는다. 다음 페이지가 있는지(`hasNext`)만 준다.
 */
interface BackendSearchResponse {
  content: BackendMusicDetail[];
  page: number;
  size: number;
  hasNext: boolean;
}

/**
 * GET /api/music/search?q=<키워드>&page=<0-based>
 *
 * 백엔드는 파라미터 이름이 `query` 이고 0-based `page` 를 요구한다. 여기서 이름을 맞춘다.
 * 응답은 **한 페이지**다 — 화면이 무한 스크롤로 이어 붙인다 (SEARCH-01).
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const empty: MusicSearchPage = { items: [], page, hasNext: false };
  if (!q) return ok(empty);

  if (!isBackendEnabled()) return ok(mockSearchPage(q, page));

  const upstream = `/api/music/search?query=${encodeURIComponent(q)}&page=${page}`;
  try {
    const res = await backendGet<BackendSearchResponse>(upstream);
    const body: MusicSearchPage = {
      items: res.content.map((m) => ({ id: m.id, title: m.title, artist: m.artist })),
      page: res.page ?? page,
      hasNext: res.hasNext ?? false,
    };
    return okLive(body, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}

/** 목도 같은 모양으로 잘라 준다 — 화면이 실데이터와 목을 가려 쓰지 않게 */
function mockSearchPage(q: string, page: number): MusicSearchPage {
  const all = mockSearch(q);
  const from = page * SEARCH_PAGE_SIZE;
  return { items: all.slice(from, from + SEARCH_PAGE_SIZE), page, hasNext: from + SEARCH_PAGE_SIZE < all.length };
}
