import { fail, ok } from "@/lib/api-response";
import { mockPlaylists } from "@/mocks/playlist";

/** 플레이리스트 생성. body: { playlistName } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { playlistName?: string };
  const name = body.playlistName?.trim();
  if (!name) return fail("VALIDATION_ERROR", "플레이리스트 이름이 필요합니다.", 400);
  return ok(mockPlaylists.create(name), 201);
}
