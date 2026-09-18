import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPatchForm, BackendError, callerAuth } from "@/lib/backend";

const UPSTREAM = "/api/user/image";

/**
 * 브라우저가 보내는 값은 믿지 않는다 — 여기가 신뢰 경계다.
 * 백엔드도 검사하지만(`UNSUPPORTED_FILE_TYPE`·`FILE_TOO_LARGE`), 거기까지 갔다 오면
 * 사진 한 장을 통째로 올린 뒤에야 "안 된다" 를 듣는다.
 */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * PATCH /bff/user/image — 프로필 사진 파일 업로드 (USER-02, S15P21A405-474).
 *
 * 백엔드는 `multipart/form-data` 의 `file` 파트만 받고 주소 문자열은 받지 않는다
 * (S15P21A405-426). 그래서 여기서도 **주소를 대신 넣어 주지 않는다** — 화면이 파일을 고른다.
 *
 * 받은 파일을 새 `FormData` 에 옮겨 담아 보낸다. 원본 요청 본문을 그대로 흘려보내면
 * 경계 문자열과 헤더를 우리가 맞춰야 하는데, 한 파트뿐이라 다시 만드는 편이 짧고 안전하다.
 *
 * **지우는 길은 아직 없다.** 백엔드에 삭제 API 가 없어서 한 번 올리면 다른 사진으로 덮는
 * 것만 된다 (BACKEND-NOTES A-37 로 요청해 뒀다).
 */
export async function PATCH(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File) || file.size === 0) return fail("VALIDATION_ERROR", "올릴 사진을 골라 주세요.", 400);
  if (!file.type.startsWith("image/")) return fail("UNSUPPORTED_FILE_TYPE", "이미지 파일만 올릴 수 있어요.", 400);
  if (file.size > MAX_BYTES) return fail("FILE_TOO_LARGE", "사진은 5MB 까지 올릴 수 있어요.", 400);

  const upload = new FormData();
  upload.append("file", file, file.name);

  try {
    const data = await backendPatchForm<{ imageUrl: string }>(UPSTREAM, upload, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
