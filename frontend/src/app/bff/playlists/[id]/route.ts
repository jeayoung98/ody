import { fail, failLive, ok, okLive } from "@/lib/api-response";
import {
  backendGet,
  BackendError,
  isBackendEnabled,
  toMusic,
  type BackendPlaylistDetailResponse,
} from "@/lib/backend";
import { mockPlaylists } from "@/mocks/playlist";
import type { PlaylistDetail } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 백엔드 플리 상세 → 화면이 쓰는 PlaylistDetail.
 *
 * 백엔드에 없는 값은 **지어내지 않고 비운다** — 소유자·생성/수정 시각·좋아요·무드 태그·곡 추가 시각
 * (BACKEND-NOTES 필드 대조). 소유자가 없으니 `isMine` 은 늘 false 라 편집 UI 가 뜨지 않는다.
 * 이 항목들을 살리려면 백엔드 응답에 필드가 더해져야 한다 (팀 결정 대기 — 요약 6번).
 */
function toPlaylistDetail(res: BackendPlaylistDetailResponse): PlaylistDetail {
  const items = res.musics.map((m) => ({ playlistId: res.playlistId, musicId: m.id, addedAt: null, music: toMusic(m) }));
  return {
    id: res.playlistId,
    email: null,
    playlistName: res.playlistName,
    likeCnt: null,
    createdAt: null,
    updatedAt: null,
    ownerNickname: null,
    moodTags: [],
    itemCount: res.musicCnt ?? items.length,
    totalDuration: res.totalDuration ?? 0,
    isLiked: false,
    items,
  };
}

/**
 * GET /bff/playlists/{id} — 플리 상세 (PATH-06).
 * `BACKEND_ACCESS_TOKEN` 이 있으면 배포 백엔드의 `GET /api/playlist/detail?playlistId=` 를 대신 호출한다 (S15P21A405-214).
 * 곡마다 `location`(pc1~pc16) 이 함께 오므로 별자리 좌표를 따로 구하지 않는다.
 * 없는 id 에 백엔드가 404 가 아니라 500 을 준다 (B-24) — 상태를 그대로 넘기되 코드는 PLAYLIST_NOT_FOUND 로 둔다
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const playlistId = Number(id);
  if (!playlistId) return fail("VALIDATION_ERROR", "플레이리스트 ID 가 올바르지 않습니다.", 400);

  if (!isBackendEnabled()) {
    const p = mockPlaylists.get(playlistId);
    if (!p) return fail("PLAYLIST_NOT_FOUND", "존재하지 않는 플레이리스트입니다.", 404);
    return ok(p);
  }

  const upstream = `/api/playlist/detail?playlistId=${playlistId}`;
  try {
    const res = await backendGet<BackendPlaylistDetailResponse>(upstream);
    return okLive(toPlaylistDetail(res), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("PLAYLIST_NOT_FOUND", err.message, err.status || 502, upstream);
  }
}

/** DELETE — 아직 목이다. 백엔드는 `DELETE /api/playlist/delete/{id}` (모양 대조 뒤 연결) */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  mockPlaylists.remove(Number(id));
  return ok({ ok: true });
}
