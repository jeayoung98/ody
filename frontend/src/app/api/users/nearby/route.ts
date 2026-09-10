import { ok } from "@/lib/api-response";
import { mockNearbyUsers } from "@/mocks/user";

/** GET /api/users/nearby?layer=<n> — 그 레이어(영역)에 있는 공개 계정 사용자 */
export function GET(req: Request) {
  const layer = Number(new URL(req.url).searchParams.get("layer") ?? 0);
  return ok(mockNearbyUsers(layer));
}
