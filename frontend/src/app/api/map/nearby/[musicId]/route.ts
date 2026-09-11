import { ok } from "@/lib/api-response";
import { mockNearby } from "@/mocks/music";

export async function GET(_req: Request, { params }: { params: Promise<{ musicId: string }> }) {
  const { musicId } = await params;
  return ok(mockNearby(Number(musicId)));
}
