import { fail, ok } from "@/lib/api-response";
import { mockPlaylists } from "@/mocks/playlist";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const p = mockPlaylists.get(Number(id));
  if (!p) return fail("PLAYLIST_NOT_FOUND", "존재하지 않는 플레이리스트입니다.", 404);
  return ok(p);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  mockPlaylists.remove(Number(id));
  return ok({ ok: true });
}
