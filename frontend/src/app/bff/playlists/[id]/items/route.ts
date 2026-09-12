import { fail, ok } from "@/lib/api-response";
import { mockPlaylists } from "@/mocks/playlist";

/** 곡 추가. body: { musicId } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { musicId?: number };
  if (!body.musicId) return fail("VALIDATION_ERROR", "musicId 가 필요합니다.", 400);
  const p = mockPlaylists.addItem(Number(id), body.musicId);
  if (!p) return fail("PLAYLIST_NOT_FOUND", "존재하지 않는 플레이리스트입니다.", 404);
  return ok(p);
}
