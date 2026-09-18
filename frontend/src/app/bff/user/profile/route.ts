import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError, callerAuth } from "@/lib/backend";
import { nicknameError } from "@/lib/auth-rules";

const UPSTREAM = "/api/user/profile";

/**
 * 프로필 부분 수정 — 닉네임·프로필 이미지 (AUTH-01 · USER-02, S15P21A405-462 · 470).
 *
 * 가입 직후 닉네임 화면과 프로필 수정 화면이 **같은 경로**를 쓴다. 백엔드에 닉네임 전용
 * 엔드포인트가 없고 이 하나가 그 역할을 한다 (BACKEND-NOTES A-13). 넘기지 않은 필드는 그대로 둔다.
 *
 * 길이 검사를 여기서 한 번 더 하는 이유: 백엔드가 잘못된 값에 `INVALID_INPUT` 하나로만 답해서,
 * 그대로 올리면 화면이 "2~20자" 를 짚어 주지 못한다.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { nickname?: string; imageUrl?: string | null };

  const patch: { nickname?: string; imageUrl?: string | null } = {};
  if (body.nickname !== undefined) {
    const nickname = body.nickname.trim();
    if (nicknameError(nickname)) return fail("INVALID_NICKNAME_LENGTH", "닉네임은 2~20자여야 합니다.", 400);
    patch.nickname = nickname;
  }
  // 빈 문자열은 "지운다" 는 뜻이라 null 로 바꿔 보낸다 — 그대로 보내면 빈 주소가 저장된다
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl?.trim() || null;

  if (!Object.keys(patch).length) return fail("VALIDATION_ERROR", "바꿀 값이 없습니다.", 400);

  try {
    const data = await backendPatch<{ nickname: string; imageUrl: string | null }>(UPSTREAM, patch, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.code === "NICKNAME_ALREADY_EXISTS" ? "NICKNAME_ALREADY_EXISTS" : "INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
