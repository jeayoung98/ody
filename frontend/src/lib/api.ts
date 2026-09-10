import { STORAGE_KEYS } from "@/constants";
import type { ApiErrorCode, ApiResponse } from "@/types";
import { readStorage } from "./storage";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

/**
 * 모든 API 호출의 단일 통로.
 * - `Authorization: Bearer {accessToken}` 을 붙인다 (§0.1)
 * - `{ success, data, error }` 봉투를 벗겨 data 만 돌려준다 (§0.2)
 * - 실패면 code 를 담은 ApiError 를 던진다 (§0.4, §0.5)
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readStorage<string>(STORAGE_KEYS.accessToken);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // refresh token 이 httpOnly 쿠키로 심겨 있어서, 다른 오리진이어도 쿠키를 실어 보내야 한다
    credentials: "include",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!body) throw new ApiError(res.status, "INTERNAL_ERROR", "응답을 읽을 수 없습니다.");
  if (!body.success) throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "요청에 실패했습니다.");

  return body.data;
}
