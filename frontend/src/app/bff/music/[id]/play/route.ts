import { ok } from "@/lib/api-response";

/** 재생 로그 기록 (play_history). 목에서는 성공만 반환 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ok({ ok: true, musicId: Number(id) });
}
