import { failLive, fail, ok, okLive } from "@/lib/api-response";
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
 * GET /bff/music/search — 음악 검색 (SEARCH-01 · S15P21A405-399).
 *
 * 화면이 보내는 조건은 셋 중 하나다.
 *
 * | 화면 → BFF | BFF → Backend |
 * | --- | --- |
 * | `?q=Love` | `?query=Love` |
 * | `?artist=Radiohead` | `?artist=Radiohead` |
 * | `?artist=Radiohead&music=Creep` | 그대로 |
 * | `?music=Love&artist=Lana Del Rey` | 그대로 |
 *
 * 통합 검색만 이름이 다르다(`q` → `query`). 그 변환이 이 라우트가 있는 이유고, 화면은
 * 백엔드 파라미터 이름을 몰라도 된다.
 *
 * **`query` 와 `music`/`artist` 를 섞지 않는다.** `music` 단독도 안 된다 — 백엔드가 400 이다.
 * 화면 쪽에서 이미 막지만, 여기서 한 번 더 본다. 여기서 걸리면 무엇이 잘못됐는지 남는다.
 *
 * ⚠️ **배포 백엔드는 아직 `query`·`page` 만 받는다** (2026-09-17 스웨거 확인, S15P21A405-365 미배포).
 * 그때까지 `artist`/`music` 경로는 목에서만 동작하고, 실백엔드로는 400 이 올라온다.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const artist = (sp.get("artist") ?? "").trim();
  const music = (sp.get("music") ?? "").trim();
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const empty: MusicSearchPage = { items: [], page, hasNext: false };

  if (q && (artist || music)) return fail("INVALID_INPUT", "통합 검색과 조건 검색을 함께 쓸 수 없습니다.", 400);
  if (music && !artist) return fail("INVALID_INPUT", "음악 조건만으로는 검색할 수 없습니다. 아티스트를 함께 지정하세요.", 400);
  if (!q && !artist) return ok(empty);

  if (!isBackendEnabled()) return ok(mockSearchPage({ q, artist, music }, page));

  const upstream = `/api/music/search?${backendQuery({ q, artist, music, page })}`;
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

/** 백엔드 파라미터 이름으로 바꾼다 — 통합 검색만 `q` → `query` 다 */
function backendQuery({ q, artist, music, page }: { q: string; artist: string; music: string; page: number }): string {
  const p = new URLSearchParams();
  if (q) p.set("query", q);
  else {
    p.set("artist", artist);
    if (music) p.set("music", music);
  }
  p.set("page", String(page));
  return p.toString();
}

/** 목도 같은 조건과 같은 페이지 모양으로 답한다 — 화면이 실데이터와 목을 가려 쓰지 않게 */
function mockSearchPage(cond: { q: string; artist: string; music: string }, page: number): MusicSearchPage {
  const all = mockSearch(cond);
  const from = page * SEARCH_PAGE_SIZE;
  return { items: all.slice(from, from + SEARCH_PAGE_SIZE), page, hasNext: from + SEARCH_PAGE_SIZE < all.length };
}
