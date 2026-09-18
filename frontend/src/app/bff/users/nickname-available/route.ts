import { failLive, ok, okLive } from "@/lib/api-response";
import { backendGet, BackendError } from "@/lib/backend";
import { nicknameError } from "@/lib/auth-rules";

/**
 * 닉네임 사용 가능 여부 (AUTH-01) — **배포 백엔드 실연동** (S15P21A405-462).
 * 형식이 틀린 값은 물어보지 않는다 — 백엔드가 그때 `INVALID_NICKNAME_LENGTH` 로 답하는데,
 * 화면은 "쓸 수 있나" 만 알면 되고 형식 안내는 이미 입력란이 하고 있다.
 */
export async function GET(req: Request) {
  const nickname = (new URL(req.url).searchParams.get("nickname") ?? "").trim();
  if (nicknameError(nickname)) return ok({ available: false });

  const upstream = `/api/users/nickname-available?nickname=${encodeURIComponent(nickname)}`;
  try {
    const data = await backendGet<{ available: boolean }>(upstream);
    return okLive(data, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
