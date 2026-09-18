import { ok } from "@/lib/api-response";
import { mockNearbyUsers } from "@/mocks/user";

/**
 * ⚠ **목이다. 배포 API 에 이 기능이 없다** (BACKEND-NOTES A-36, 2026-09-18 스펙 34개 경로 대조).
 * 지우지 않고 남긴 이유: 화면·훅은 이미 다 있어서, 백엔드가 생기면 이 파일만 바꾸면 된다.
 * **여기서 나온 값을 지표나 시연의 근거로 쓰면 안 된다.**
 */
/** GET /bff/users/nearby?layer=<n> — 그 레이어(영역)에 있는 공개 계정 사용자 */
export function GET(req: Request) {
  const layer = Number(new URL(req.url).searchParams.get("layer") ?? 0);
  return ok(mockNearbyUsers(layer));
}
