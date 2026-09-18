import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError, callerAuth } from "@/lib/backend";
import type { PlaylistDetail } from "@/types";

const UPSTREAM = "/api/playlist/create";

/**
 * 플레이리스트 생성 (PATH-06) — **배포 백엔드 실연동** (S15P21A405-468).
 * 주인은 토큰으로 정해지므로 호출자 자격으로 부른다. 빈 플리로 만들고 곡은 따로 넣는다.
 *
 * 응답으로 되돌려 주는 상세는 **방금 만든 그대로** 다 — 좋아요·무드 태그·소유자는 백엔드에
 * 없어서 비어 있다 (BACKEND-NOTES A-36). 화면은 이 값을 쓰지 않고 목록을 다시 읽는다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { playlistName?: string };
  const playlistName = body.playlistName?.trim();
  if (!playlistName) return fail("VALIDATION_ERROR", "플레이리스트 이름이 필요합니다.", 400);

  try {
    const res = await backendPost<{ playlistId: number; playlistName: string; musicCnt: number }>(
      UPSTREAM,
      { playlistName, musicIdList: [] },
      { headers: callerAuth(req) },
    );
    const created: PlaylistDetail = {
      id: res.playlistId,
      email: null,
      playlistName: res.playlistName,
      likeCnt: null,
      createdAt: null,
      updatedAt: null,
      ownerNickname: null,
      moodTags: [],
      itemCount: res.musicCnt ?? 0,
      totalDuration: 0,
      isLiked: false,
      items: [],
    };
    return okLive(created, UPSTREAM, 201);
  } catch (e) {
    const err = e as BackendError;
    // 이름 중복은 백엔드가 자기 코드로 답한다 — 그대로 올린다
    return failLive(err.code === "PLAYLIST_NAME_DUPLICATED" ? "PLAYLIST_NAME_DUPLICATED" : "INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
