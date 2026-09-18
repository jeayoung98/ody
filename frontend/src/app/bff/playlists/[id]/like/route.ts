import { fail } from "@/lib/api-response";

/**
 * 좋아요 토글 — **배포 API 에 없다** (BACKEND-NOTES A-36).
 *
 * 목으로 성공한 척하지 않는다. 그러면 눌렀을 때 켜졌다가 새로고침하면 꺼져 있어서
 * "가끔 저장이 안 되는" 고장으로 보이고, 원인을 찾는 데 시간이 든다.
 */
export function POST() {
  return fail("NOT_IMPLEMENTED", "좋아요는 아직 서버에 없습니다.", 501);
}
