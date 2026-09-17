import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { MusicSearchPage, MusicSearchResult, SearchCondition } from "@/types";

/**
 * 조건을 다듬는다 — 앞뒤 공백은 검색어가 아니다. 백엔드도 trim 한 값을 기준으로 앞일치한다.
 *
 * `%` `_` `\` 를 **프론트에서 건드리지 않는다** (전달 문서 §7). 사용자가 친 그대로 보내고
 * 와일드카드 해석은 하지 않는다 — 여기서 이스케이프하면 서버가 또 해서 두 번 처리된다.
 */
function normalize(c: SearchCondition): SearchCondition {
  if (c.mode === "all") return { mode: "all", query: c.query.trim() };
  if (c.mode === "artist") return { mode: "artist", artist: c.artist.trim(), music: c.music.trim() };
  return { mode: "music", music: c.music.trim(), artist: c.artist.trim() };
}

/**
 * 조건을 물어볼 수 있는가.
 *
 * `music` 모드에서 아티스트가 비어 있으면 **요청하지 않는다** — 백엔드가 `music` 단독을
 * 400 으로 막기 때문이다. 화면에서는 "아티스트를 입력하세요" 안내가 뜨는 대기 상태다.
 */
export function canSearch(c: SearchCondition): boolean {
  const n = normalize(c);
  if (n.mode === "all") return n.query.length > 0;
  if (n.mode === "artist") return n.artist.length > 0;
  return n.music.length > 0 && n.artist.length > 0;
}

/**
 * 조건 → BFF 요청 경로. **직렬화는 여기 한 곳에서만 한다** (전달 문서 §7).
 * 백엔드 파라미터 이름으로 바꾸는 일은 BFF 라우트가 맡는다 — 화면은 `q`/`artist`/`music` 만 안다.
 *
 * `query` 와 `music`/`artist` 를 **섞지 않는다.** 섞어 보내면 백엔드가 400 을 준다.
 */
export function searchRequestPath(c: SearchCondition, page: number): string {
  const n = normalize(c);
  const p = new URLSearchParams();
  if (n.mode === "all") p.set("q", n.query);
  else if (n.mode === "artist") {
    p.set("artist", n.artist);
    if (n.music) p.set("music", n.music); // 빈 선택 입력은 아예 생략한다
  } else {
    p.set("music", n.music);
    p.set("artist", n.artist);
  }
  p.set("page", String(page));
  return `${API_ENDPOINTS.music.search}?${p.toString()}`;
}

/**
 * 음악 검색 (SEARCH-01 · S15P21A405-399). **한 페이지씩 받아 이어 붙인다** — 결과가 17만 건까지
 * 나오므로 첫 10곡만 보여주고 끝낼 수 없다. 백엔드가 `hasNext` 를 주므로 전체 건수는 필요 없다.
 *
 * 조건이 바뀌면 쿼리 키가 바뀌어 **처음부터 다시 쌓인다** — 이전 조건의 결과가 새 조건의
 * 결과인 척 남지 않는다.
 */
export function useMusicSearchQuery(condition: SearchCondition) {
  const c = normalize(condition);
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.music.search(c),
    queryFn: ({ pageParam }) => api<MusicSearchPage>(searchRequestPath(c, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: canSearch(c),
  });
}

/**
 * 받아 둔 페이지를 한 목록으로 편다. **음악 ID 로 중복을 걷어낸다** — 페이지를 받는 사이에
 * 정렬 기준 값이 바뀌면 같은 곡이 두 페이지에 걸쳐 올 수 있고, 그러면 화면에 두 번 뜬다.
 */
export function flattenSearch(pages: MusicSearchPage[] | undefined): MusicSearchResult[] {
  const seen = new Set<number>();
  const out: MusicSearchResult[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}
