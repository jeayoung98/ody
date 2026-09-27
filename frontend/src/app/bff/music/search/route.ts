import { failLive, fail, ok, okLive } from "@/lib/api-response";
import { backendGet, BackendError, isBackendEnabled, type BackendMusicDetail } from "@/lib/backend";
import { SEARCH_PAGE_SIZE, TITLE_SEARCH_MAX_UPSTREAM_PAGES } from "@/constants";
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
 * | `?music=Love` | `?query=Love` 결과를 제목 앞일치로 거름 |
 * | `?music=Love&artist=Lana Del Rey` | 그대로 |
 *
 * 통합 검색만 이름이 다르다(`q` → `query`). 그 변환이 이 라우트가 있는 이유고, 화면은
 * 백엔드 파라미터 이름을 몰라도 된다.
 *
 * **`query` 와 `music`/`artist` 를 섞지 않는다.** 제목 단독은 백엔드가 아직 받지 않으므로
 * 통합 검색을 제한된 페이지만 조회해 제목 앞일치 결과로 바꾼다.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const artist = (sp.get("artist") ?? "").trim();
  const music = (sp.get("music") ?? "").trim();
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const empty: MusicSearchPage = { items: [], page, hasNext: false };

  if (q && (artist || music)) return fail("INVALID_INPUT", "통합 검색과 조건 검색을 함께 쓸 수 없습니다.", 400);
  if (!q && !artist && !music) return ok(empty);

  if (!isBackendEnabled()) return ok(mockSearchPage({ q, artist, music }, page));

  if (music && !artist) {
    let upstream = titleFallbackPath(music, 0);
    try {
      const body = await searchTitleOnlyPage(music, page, (upstreamPage) => {
        upstream = titleFallbackPath(music, upstreamPage);
        return backendGet<BackendSearchResponse>(upstream);
      });
      return okLive(body, upstream);
    } catch (e) {
      const err = e as BackendError;
      return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
    }
  }

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

/**
 * 제목 단독 검색 임시 경로. 통합 검색의 순서를 유지하며 제목 앞일치만 모은다.
 * 필요한 결과를 채우거나 상한에 닿으면 멈춰, 빈 결과에서도 무한 호출하지 않는다.
 */
export async function searchTitleOnlyPage(
  music: string,
  page: number,
  readPage: (page: number) => Promise<BackendSearchResponse>,
): Promise<MusicSearchPage> {
  const prefix = music.toLowerCase();
  const needed = (page + 1) * SEARCH_PAGE_SIZE + 1;
  const matches: BackendMusicDetail[] = [];

  for (let upstreamPage = 0; upstreamPage < TITLE_SEARCH_MAX_UPSTREAM_PAGES && matches.length < needed; upstreamPage += 1) {
    const res = await readPage(upstreamPage);
    matches.push(...res.content.filter((item) => item.title.toLowerCase().startsWith(prefix)));
    if (!res.hasNext) break;
  }

  const from = page * SEARCH_PAGE_SIZE;
  return {
    items: matches.slice(from, from + SEARCH_PAGE_SIZE).map((item) => ({ id: item.id, title: item.title, artist: item.artist })),
    page,
    hasNext: matches.length > from + SEARCH_PAGE_SIZE,
  };
}

function titleFallbackPath(music: string, page: number): string {
  const p = new URLSearchParams({ query: music, page: String(page) });
  return `/api/music/search?${p.toString()}`;
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
