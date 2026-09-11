/**
 * localStorage / sessionStorage 안전 래퍼. SSR / 접근 차단 환경에서도 예외 없이 동작.
 * "로그인 상태 유지"를 끄면 토큰을 session 에 넣어 탭을 닫으면 사라지게 한다 (AUTH-02).
 */
export type StorageScope = "local" | "session";

const pick = (scope: StorageScope) => (scope === "session" ? window.sessionStorage : window.localStorage);
const SCOPES: StorageScope[] = ["local", "session"];

/** 두 저장소를 모두 본다 — 어디에 넣었는지 읽는 쪽이 신경 쓰지 않게 */
export function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  for (const scope of SCOPES) {
    try {
      const raw = pick(scope).getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function writeStorage<T>(key: string, value: T, scope: StorageScope = "local"): void {
  if (typeof window === "undefined") return;
  try {
    pick(scope).setItem(key, JSON.stringify(value));
    // 같은 키가 다른 저장소에 남아 있으면 읽는 순서 때문에 옛 값이 살아난다
    pick(scope === "local" ? "session" : "local").removeItem(key);
  } catch {
    /* ignore */
  }
}

export function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  for (const scope of SCOPES) {
    try {
      pick(scope).removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
