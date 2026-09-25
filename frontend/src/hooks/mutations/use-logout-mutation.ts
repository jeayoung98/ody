import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, CHANGED, STORAGE_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import { clearPersistedQueries } from "@/lib/query-persist";
import { readStorage, removeStorage } from "@/lib/storage";
import type { ApiResponse } from "@/types";

/**
 * 로그아웃 한 번. **동기로 끝난다** (S15P21A405-588) — 서버 정리는 던져 놓고 기다리지 않는다.
 *
 * 순서가 이 기능의 전부라 훅에서 떼어 뒀다. 셋 다 어긋나면 각각 다르게 고장난다.
 *
 * 1. **토큰을 먼저 들고 나온다.** 3 에서 저장소를 비우므로 그 뒤에는 읽을 곳이 없다
 * 2. **요청을 띄우고 기다리지 않는다.** 기다리면 그 시간이 통째로 사용자 대기가 된다
 * 3. **로컬을 비운다.** 여기까지가 사용자가 보는 로그아웃이다
 */
export function runLogout(deps: { readToken: () => string | null; endSession: (token: string | null) => Promise<void>; clearLocal: () => void }): void {
  const token = deps.readToken();
  void deps.endSession(token);
  deps.clearLocal();
}

/**
 * 서버 세션을 끊는다. **아무도 기다리지 않는다** — 실패해도 다시 시도하지 않고 조용히 끝난다.
 * 화면에서의 로그아웃은 이미 끝난 뒤라 알릴 것이 없다.
 *
 * **`lib/api.ts` 의 `api()` 를 쓰지 않는다.** 그쪽은 401 이면 재발급한 새 토큰을 **저장소에
 * 써 넣는데**, 여기서는 저장소가 막 비워진 참이라 방금 로그아웃한 사람이 다시 로그인된
 * 상태로 되살아난다. 그래서 재발급도 손으로 하고 결과를 어디에도 남기지 않는다.
 *
 * 만료된 토큰으로 한 번 더 시도하는 이유는 **refresh 쿠키** 때문이다. 백엔드가 그 쿠키를
 * 지우는 `Set-Cookie` 를 주는데(`bff/auth/logout`), 401 로 끝나면 쿠키가 살아남는다.
 */
export async function endServerSession(token: string | null, fetchImpl: typeof fetch = fetch): Promise<void> {
  const post = (t: string | null) => fetchImpl(API_ENDPOINTS.auth.logout, { method: "POST", headers: t ? { Authorization: `Bearer ${t}` } : undefined });
  try {
    if ((await post(token)).status !== 401) return;
    const res = await fetchImpl(API_ENDPOINTS.auth.reissue, { method: "POST" });
    const body = (await res.json().catch(() => null)) as ApiResponse<{ accessToken: string }> | null;
    if (body?.success && body.data.accessToken) await post(body.data.accessToken);
  } catch {
    /* 네트워크가 끊겼거나 서버가 죽었다. 로컬 로그아웃은 이미 끝났다 */
  }
}

/**
 * 로그아웃 (AUTH-02).
 *
 * **서버 응답을 기다리지 않는다** (S15P21A405-588). 예전에는 `POST /bff/auth/logout` 을
 * await 했는데, 그동안 화면은 마이페이지 그대로였고 바뀌는 것은 메뉴 글자 하나뿐이었다
 * ("로그아웃 중…"). 응답을 8초 늦춰 재 보니 8초 내내 제자리였고, 응답이 온 뒤 로그인
 * 화면까지는 113ms 였다 — **기다림이 전부 요청 시간이었다.**
 *
 * 액세스 토큰 수명이 30분이라 만료된 상태에서 누르는 일이 잦고, 그러면 401 → 재발급 →
 * 재시도로 왕복이 세 번이다. 타임아웃도 없어서 답이 안 오면 영영 안 간다.
 *
 * 로그아웃은 **사용자가 이미 결정한 일**이라 서버에 물어볼 것이 없다. 그래서 로컬을 먼저
 * 비우고, 서버 세션 정리는 뒤에서 따라가게 한다.
 */
export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      runLogout({
        readToken: () => readStorage<string>(STORAGE_KEYS.accessToken),
        endSession: endServerSession,
        clearLocal: () => {
          removeStorage(STORAGE_KEYS.accessToken);
          qc.clear();
          // 메모리만 비우면 새로고침 때 저장소에서 남의 프로필이 되살아난다 (S15P21A405-504)
          clearPersistedQueries();
        },
      });
      // 토스트 스토어는 쿼리 캐시가 아니라 살아남는다 — 로그인 화면으로 넘어가도 한 번 보인다 (S15P21A405-667)
      useToastStore.getState().show(CHANGED.loggedOut);
      return null;
    },
  });
}
