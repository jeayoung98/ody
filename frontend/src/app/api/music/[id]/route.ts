import { ok } from "@/lib/api-response";
import { mockMusicDetail } from "@/mocks/music";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ok(mockMusicDetail(Number(id)));
}
