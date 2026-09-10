import { ok } from "@/lib/api-response";

/** user.tutorial_completed = true 로 갱신. 목에서는 성공만 반환 */
export function POST() {
  return ok({ ok: true });
}
