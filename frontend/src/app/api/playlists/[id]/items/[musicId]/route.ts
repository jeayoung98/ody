import { fail, ok } from "@/lib/api-response";
import { mockPlaylists } from "@/mocks/playlist";

/** 곡 삭제 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; musicId: string }> }) {
  const { id, musicId } = await params;
  const p = mockPlaylists.removeItem(Number(id), Number(musicId));
  if (!p) return fail("PLAYLIST_NOT_FOUND", "존재하지 않는 플레이리스트입니다.", 404);
  return ok(p);
}
