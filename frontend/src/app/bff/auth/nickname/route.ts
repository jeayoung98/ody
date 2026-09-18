import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError, callerAuth } from "@/lib/backend";
import { nicknameError } from "@/lib/auth-rules";

const UPSTREAM = "/api/user/profile";

/**
 * 닉네임 확정 (AUTH-01) — **배포 백엔드 실연동** (S15P21A405-462).
 * 백엔드에 닉네임 전용 엔드포인트는 없고 `PATCH /api/user/profile` 이 그 역할을 한다 (A-13).
 * 누구의 닉네임인지는 토큰으로 정해지므로 호출자 자격으로 부른다.
 *
 * 길이 검사를 여기서 한 번 더 하는 이유: 백엔드가 잘못된 값에 `INVALID_INPUT` 하나로만 답해서,
 * 그대로 올리면 화면이 "2~20자" 를 짚어 주지 못한다.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { nickname?: string };
  const nickname = (body.nickname ?? "").trim();
  if (nicknameError(nickname)) return fail("INVALID_NICKNAME_LENGTH", "닉네임은 2~20자여야 합니다.", 400);

  try {
    const data = await backendPatch<{ nickname: string; imageUrl: string | null }>(UPSTREAM, { nickname }, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
