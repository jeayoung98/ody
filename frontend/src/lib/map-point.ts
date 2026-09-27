import { NO_GENRE_ID } from "@/constants";
import type { MapPoint, Music } from "@/types";

/**
 * ERD `Music` → 지도 엔진이 편입(adopt)할 수 있는 `MapPoint`.
 * 좌표(`location`)가 없는 곡은 null — 0 으로 채워 넣으면 원점 한 점에 뭉친다 (troubleshooting 002 와 같은 증상).
 * 플리 상세의 곡을 별자리에 올릴 때 쓴다 (S15P21A405-214). 장르 id 는 백엔드가 이름만 주므로 무장르로 둔다
 */
export function musicToMapPoint(m: Music): MapPoint | null {
  if (!m.location) return null;
  return {
    musicId: m.id,
    pc: [...m.location],
    genreId: NO_GENRE_ID,
    weight: m.playCnt,
    title: m.title,
    artist: m.artist,
    // 편입된 곡도 진짜 커버를 받아야 한다 — 시연 곡이 절차적 커버로 뜨면 곤란하다 (S15P21A405-717)
    albumMbid: m.albumMbid ?? null,
    youtubeUrl: m.youtubeUrl,
    playable: m.youtubeUrl != null,
  };
}
