import { ok } from "@/lib/api-response";
import { representativeLayersOf } from "@/mocks/songs";

/**
 * 이 곡이 **대표곡으로 노출되는 레이어 목록** (오름차순).
 * 한 곡이 여러 레이어에서 동시에 대표곡일 수 있다. 검색 결과 클릭 시 첫 번째 레이어로 이동한다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ok({ musicId: Number(id), layers: representativeLayersOf(Number(id)) });
}
