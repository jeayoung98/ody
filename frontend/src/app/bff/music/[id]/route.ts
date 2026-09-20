import { fail, failLive, ok, okLive } from "@/lib/api-response";
import {
  backendGet,
  BackendError,
  isBackendEnabled,
  toMusic,
  toPcArray,
  type BackendMusicDetailResponse,
} from "@/lib/backend";
import { mockMusicDetail } from "@/mocks/music";
import type { MusicDetail } from "@/types";

/**
 * 백엔드 상세 응답 → 화면이 쓰는 MusicDetail.
 *
 * 백엔드에 없는 값은 **지어내지 않고 비운다.** `releaseYear` 는 응답에 없고,
 * `albumCoverUrl`·`country`·`language`·`composer`·`lyricist`·`moods` 는 ERD 에도 없다
 * (BACKEND-NOTES E-5). `relatedPlaylists` 는 조회 API 가 아직 없다.
 */
function toMusicDetail(res: BackendMusicDetailResponse): MusicDetail {
  const pc = toPcArray(res.location);
  return {
    ...toMusic(res),
    // 백엔드는 장르를 **이름만** 준다. id 는 배열 순번을 채운 자리표시자이지 실제 genre.id 가 아니다 (B-21)
    // 16개를 **원값 그대로** 보낸다. 축마다 흩어진 폭이 달라서 어느 것이 유별난지는
    // 상주 집합의 축별 폭으로 재야 알 수 있다 — 그 잣대를 가진 쪽은 화면이다 (S15P21A405-355)
    principalComponents: pc.map((v, i) => ({ axis: i, value: v })),
    nearby: res.neighbors.map((n) => ({ id: n.id, title: n.title, artist: n.artist })),
    relatedPlaylists: [],
  };
}

/** GET /api/music/{id} — 곡 상세. 백엔드 `GET /api/music/detail?id=` 이 주변곡까지 같이 준다 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const musicId = Number(id);
  if (!musicId) return fail("VALIDATION_ERROR", "곡 ID 가 올바르지 않습니다.", 400);

  if (!isBackendEnabled()) return ok(mockMusicDetail(musicId));

  const upstream = `/api/music/detail?id=${musicId}`;
  try {
    const res = await backendGet<BackendMusicDetailResponse>(upstream);
    return okLive(toMusicDetail(res), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("MUSIC_NOT_FOUND", err.message, err.status || 502, upstream);
  }
}
