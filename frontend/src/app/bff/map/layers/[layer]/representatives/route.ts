import { ok } from "@/lib/api-response";
import { representativesFor } from "@/mocks/songs";

/** 레이어별 대표곡 ID. 커버로 띄우는 곡은 레이어마다 다르다 */
export async function GET(_req: Request, { params }: { params: Promise<{ layer: string }> }) {
  const { layer } = await params;
  return ok({ layer: Number(layer), musicIds: representativesFor(Number(layer)) });
}
