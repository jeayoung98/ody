import { fail, ok } from "@/lib/api-response";
import { mockPlaylists } from "@/mocks/playlist";

/** 좋아요 토글 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = mockPlaylists.toggleLike(Number(id));
  if (!p) return fail("PLAYLIST_NOT_FOUND", "존재하지 않는 플레이리스트입니다.", 404);
  return ok({ isLiked: p.isLiked, likeCnt: p.likeCnt });
}
