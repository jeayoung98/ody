import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError, callerAuth } from "@/lib/backend";
import { nicknameError } from "@/lib/auth-rules";

const UPSTREAM = "/api/user/nickname";

/**
 * PATCH /bff/user/nickname — 닉네임만 바꾼다 (AUTH-01 · USER-02, S15P21A405-474).
 *
 * 가입 직후 닉네임 화면과 프로필 수정 화면이 **같은 경로**를 쓴다.
 *
 * 예전에는 닉네임과 프로필 이미지를 `PATCH /api/user/profile` 하나로 보냈는데(A-13),
 * 백엔드가 둘을 갈라 놓으면서 그 경로가 없어졌다 (S15P21A405-426). 이미지는 파일 업로드라
 * 본문 형식부터 다르므로(`/bff/user/image`) 합쳐 둘 이유도 없다.
 *
 * 길이 검사를 여기서 한 번 더 하는 이유: 백엔드가 잘못된 값에 `INVALID_INPUT` 하나로만 답해서,
 * 그대로 올리면 화면이 "2~20자" 를 짚어 주지 못한다.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { nickname?: string };
  const nickname = body.nickname?.trim() ?? "";

  if (nicknameError(nickname)) return fail("INVALID_NICKNAME_LENGTH", "닉네임은 2~20자여야 합니다.", 400);

  try {
    const data = await backendPatch<{ nickname: string }>(UPSTREAM, { nickname }, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.code === "NICKNAME_ALREADY_EXISTS" ? "NICKNAME_ALREADY_EXISTS" : "INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
