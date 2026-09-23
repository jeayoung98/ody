import { fail } from "@/lib/api-response";
import { emailFromToken } from "@/lib/backend";
import { ContestMockError } from "@/mocks/contest";

/** 목 플레이리스트 주인과 같은 기본값 — 토큰이 없을 때(설문 모드 등) 쓴다 */
const FALLBACK_ME = "me@ody.app";

/**
 * 콘테스트 BFF 라우트 공통 (S15P21A405-602).
 * "나" 는 토큰의 `sub`(이메일)로 정한다 — 목이라도 사람마다 다른 표·출품작을 봐야 흐름이 검증된다.
 */
export function contestCaller(req: Request): { email: string; nickname: string } {
  const email = emailFromToken(req) ?? FALLBACK_ME;
  return { email, nickname: email.split("@")[0] };
}

/** 목이 던진 오류를 응답 봉투로. 그 외는 500 */
export function contestFail(e: unknown) {
  if (e instanceof ContestMockError) return fail(e.code, e.message, e.status);
  return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "콘테스트 처리에 실패했습니다.", 500);
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
