import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError, callerAuth } from "@/lib/backend";

const UPSTREAM = "/api/user/public";

/**
 * **폐지된 기능의 잔해를 지우는 자리다** (S15P21A405-574). 공개/비공개 계정은 없어졌고
 * 설정 UI 도 없다 — 이 라우트는 사용자가 고르라고 있는 것이 아니라 **전원을 공개로 못박으려고**
 * 남겨 둔 것이다.
 *
 * 배포 백엔드가 아직 `is_public` 으로 막는다 (`UserService:49` → 403 `USER_PRIVATE`).
 * `AuthMapper` 의 가입 INSERT 가 이 칸을 안 채워 DB 기본값을 타는데 그 값이 `false` 라,
 * **가입한 사람이 전부 비공개로 앉아 있다.** 그래서 남의 프로필이 아예 안 열리고 따라가기
 * 버튼까지 도달하지 못한다.
 *
 * 백엔드가 그 문을 걷어내면(BACKEND-NOTES A-59) 이 파일과 부르는 쪽을 같이 지운다.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { isPublic?: unknown };
  if (typeof body.isPublic !== "boolean") return fail("VALIDATION_ERROR", "isPublic 이 필요합니다.", 400);

  try {
    const data = await backendPatch<{ isPublic: boolean }>(UPSTREAM, { isPublic: body.isPublic }, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
