import { API_ENDPOINTS, STORAGE_KEYS } from "@/constants";
import type { ApiErrorCode, ApiResponse } from "@/types";
import { readStorage, readStorageScope, removeStorage, writeStorage } from "./storage";
import { logLiveResponse } from "./live-log";

/**
 * 비워둔다. 브라우저는 백엔드를 직접 부르지 않고 Next 서버의 rewrite 프록시를 거친다
 * (이유는 `next.config.ts` 주석 참고 — 배포 백엔드가 CORS 를 전부 막고 있고, refresh 쿠키가
 * `Secure; SameSite=Lax` 라 크로스 사이트로는 실리지 않는다).
 * 값을 채우면 브라우저가 직접 호출하게 되어 `403 Invalid CORS request` 를 받는다.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** 401 을 받아도 재발급을 시도하면 안 되는 경로 — 재발급 자체와 로그인 계열 */
const NO_REISSUE_PATHS: readonly string[] = [
  API_ENDPOINTS.auth.reissue,
  API_ENDPOINTS.auth.login,
  API_ENDPOINTS.auth.signup,
  API_ENDPOINTS.auth.exchange,
];

/**
 * 백엔드 공통 실패 응답 (§0.2 / §0.5).
 * `code` 로 분기하고 `message` 는 그대로 사용자에게 보여줄 수 있다.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 동시에 여러 요청이 401 을 받아도 재발급은 한 번만 태운다 */
let reissuing: Promise<boolean> | null = null;

/**
 * refresh 쿠키로 accessToken 을 재발급받는다 (BACKEND-NOTES B-8).
 * 토큰이 원래 sessionStorage 에 있었다면 거기에 그대로 다시 넣는다 —
 * "로그인 상태 유지" 를 끈 사용자를 재발급 때문에 영구 저장으로 올려버리지 않기 위해서다.
 */
async function reissueAccessToken(): Promise<boolean> {
  reissuing ??= (async () => {
    try {
      const res = await fetch(`${BASE_URL}${API_ENDPOINTS.auth.reissue}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
      });
      const body = (await res.json().catch(() => null)) as ApiResponse<{ accessToken: string }> | null;
      if (!res.ok || !body?.success || !body.data?.accessToken) {
        // 답을 받았는데 새 토큰이 없다 = 이 세션은 되살아나지 않는다. 죽은 토큰을 남겨 두면
        // AuthGuard 가 계속 "로그인됨" 으로 읽어서, 로그아웃을 직접 누르기 전까지 401 만
        // 받는 홈에 머문다 (S15P21A405-473). 지우면 그 자리에서 로그인으로 간다
        removeStorage(STORAGE_KEYS.accessToken);
        return false;
      }

      writeStorage(STORAGE_KEYS.accessToken, body.data.accessToken, readStorageScope(STORAGE_KEYS.accessToken) ?? "local");
      return true;
    } catch {
      // 네트워크가 끊겨 답 자체를 못 받은 경우다. 토큰은 그대로 둔다 —
      // 와이파이가 끊겼다고 로그아웃시키면 돌아왔을 때 다시 로그인해야 한다
      return false;
    } finally {
      // 다음 401 때 다시 시도할 수 있도록 비운다
      setTimeout(() => {
        reissuing = null;
      }, 0);
    }
  })();

  return reissuing;
}

function request(path: string, init?: RequestInit): Promise<Response> {
  const token = readStorage<string>(STORAGE_KEYS.accessToken);
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    // refresh token 이 httpOnly 쿠키로 심겨 있어서 쿠키를 실어 보내야 한다
    credentials: "include",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

/**
 * 모든 API 호출의 단일 통로.
 * - `Authorization: Bearer {accessToken}` 을 붙인다 (§0.1)
 * - 401 이면 refresh 쿠키로 한 번 재발급하고 같은 요청을 다시 태운다 (B-8)
 * - `{ success, data, error }` 봉투를 벗겨 data 만 돌려준다 (§0.2)
 * - 실패면 code 를 담은 ApiError 를 던진다 (§0.4, §0.5)
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t0 = performance.now();
  let res = await request(path, init);

  // 토큰이 아예 없으면 재발급해봐야 소용없다 (로그인 전 401)
  const canReissue = res.status === 401 && !NO_REISSUE_PATHS.includes(path) && readStorage<string>(STORAGE_KEYS.accessToken) != null;
  if (canReissue && (await reissueAccessToken())) {
    res = await request(path, init);
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  // 배포 백엔드에서 온 응답만 콘솔에 남긴다 (개발 빌드 한정). 목은 찍지 않는다
  logLiveResponse(path, res, body, performance.now() - t0);

  if (!body) throw new ApiError(res.status, "INTERNAL_ERROR", "응답을 읽을 수 없습니다.");
  if (!body.success) throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "요청에 실패했습니다.");

  return body.data;
}
