/**
 * localStorage / sessionStorage 안전 래퍼. SSR / 접근 차단 환경에서도 예외 없이 동작.
 * "로그인 상태 유지"를 끄면 토큰을 session 에 넣어 탭을 닫으면 사라지게 한다 (AUTH-02).
 */
export type StorageScope = "local" | "session";

const pick = (scope: StorageScope) => (scope === "session" ? window.sessionStorage : window.localStorage);
const SCOPES: StorageScope[] = ["local", "session"];

/**
 * 저장소가 바뀌었다고 **같은 탭에** 알린다 (S15P21A405-473).
 *
 * 브라우저의 `storage` 이벤트는 **다른 탭**이 바꿨을 때만 온다 — 바꾼 탭 자신은 못 듣는다.
 * 그런데 토큰을 지우는 쪽(재발급 실패, `lib/api.ts`)과 그걸 보고 로그인으로 보내는 쪽
 * (`AuthGuard` 의 `useHasToken`)이 같은 탭이라, 그 이벤트만 기다리면 영영 못 듣는다.
 * 그래서 지우거나 쓰는 자리에서 직접 알린다.
 */
const listeners = new Set<() => void>();

/** `useSyncExternalStore` 에 그대로 넘기는 구독 함수 */
export function subscribeStorage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

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

/** 값이 들어 있는 저장소를 알려준다. 토큰을 갱신할 때 원래 범위를 유지하려고 쓴다 */
export function readStorageScope(key: string): StorageScope | null {
  if (typeof window === "undefined") return null;
  for (const scope of SCOPES) {
    try {
      if (pick(scope).getItem(key)) return scope;
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
  notify();
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
  notify();
}
