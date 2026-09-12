import { ok } from "@/lib/api-response";
import { mockPlaylistRanking, mockUserRanking } from "@/mocks/user";

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (type === "topPlaylist") return ok(mockPlaylistRanking());
  return ok(mockUserRanking(type));
}
