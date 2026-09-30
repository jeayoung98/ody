import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { MapEngine } from "@/components/map/engine/map-engine";
import { albumCover } from "@/components/map/render/cover-art";
import { COVER_PX } from "@/components/map/render/sprites";
import { DEMO_SONGS, matchDemoSong, type DemoSong } from "@/constants";
import { musicDetailQueryOptions } from "@/hooks/queries/use-music-detail-query";
import { searchRequestPath } from "@/hooks/queries/use-music-search-query";
import { api } from "@/lib/api";
import { musicToMapPoint } from "@/lib/map-point";
import type { MapPoint, MusicSearchPage, SearchCondition } from "@/types";

/** 제목 검색에서 이만큼까지만 넘겨 본다 — 앞일치라 동명 곡이 많을 때 첫 장에 없을 수 있다 */
const SEARCH_PAGES = 3;

/**
 * 시연 곡 하나의 id — 적혀 있으면 그대로, 아니면 검색에서 제목·아티스트로 찾는다 (`matchDemoSong`).
 * 아티스트를 알면 **아티스트+제목으로 좁혀 먼저** 찾는다 (S15P21A405-726) — "Dynamite" 처럼 동명 곡이 많은 제목은
 * 통합 검색 3장 안에 그 곡이 안 실린다. 표기(방탄소년단/BTS)마다 한 번씩 해 보고, 다 빠지면 통합 검색으로 돈다.
 * 못 찾으면 null. 검색이 401 이든 비어 있든 예외는 부르는 쪽이 삼킨다.
 */
async function resolveId(song: DemoSong): Promise<number | null> {
  if (song.id != null) return song.id;
  const artists = Array.isArray(song.artist) ? song.artist : song.artist ? [song.artist] : [];
  const conds: SearchCondition[] = [
    ...artists.map((artist): SearchCondition => ({ mode: "artist", artist, music: song.title })),
    { mode: "all", query: song.title },
  ];
  for (const cond of conds) {
    for (let page = 0; page < SEARCH_PAGES; page++) {
      const res = await api<MusicSearchPage>(searchRequestPath(cond, page));
      const hit = matchDemoSong(song, res.items);
      if (hit) return hit.id;
      if (!res.hasNext) break;
    }
  }
  return null;
}

/** id → 좌표 있는 `MapPoint`. 상세는 세션 캐시(`staleTime: Infinity`)라 곡 패널이 열 때 다시 받지 않는다 */
async function resolvePoint(qc: QueryClient, song: DemoSong): Promise<MapPoint | null> {
  try {
    const id = await resolveId(song);
    if (id == null) return null;
    return musicToMapPoint(await qc.fetchQuery(musicDetailQueryOptions(id)));
  } catch {
    return null;
  }
}

/**
 * **시연 곡을 지도에 고정한다** (S15P21A405-717, `constants/demo-pins`).
 *
 * 지도가 뜰 때 한 번, 시연 곡마다 검색 → 곡 상세로 좌표를 받아 엔진에 편입(`adopt`)하고 `setDemoIds` 로
 * 못 박는다. 그 뒤로는 엔진이 모든 겹에서 상주로 남기고, `drawCovers` 가 늘 커버로 그린다.
 * 커버 그림도 같이 데운다 — 대표곡 예열(`map-view`)과 같은 이유로, 그릴 때 이미 와 있어야 한다.
 *
 * 한 곡이라도 실패하면 그 곡만 빠진다. 지도 데이터보다 먼저 끝나도 된다 — `setSongs` 가 먼저 편입된 곡을
 * 살린다 (S15P21A405-676 과 같은 길).
 */
export function useDemoPins(engine: MapEngine) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!DEMO_SONGS.length) return;
    let alive = true;
    void Promise.all(DEMO_SONGS.map((song) => resolvePoint(qc, song))).then((points) => {
      if (!alive) return;
      const found = points.filter((p): p is MapPoint => p != null);
      if (!found.length) return;
      engine.adopt(found);
      engine.setDemoIds(
        found.map((p) => p.musicId),
        new Map(points.flatMap((p, k) => (p && DEMO_SONGS[k].minLayer ? [[p.musicId, DEMO_SONGS[k].minLayer]] : []))),
      );
      for (const p of found) albumCover(p.musicId, p.albumMbid, COVER_PX);
    });
    return () => {
      alive = false;
    };
  }, [engine, qc]);
}
