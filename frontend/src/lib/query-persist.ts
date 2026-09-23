import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, STORAGE_KEYS } from "@/constants";
import type { User } from "@/types";
import { readStorage, removeStorage, writeStorage } from "./storage";

/**
 * 쿼리 캐시 일부를 새로고침 너머로 들고 간다 (S15P21A405-504).
 *
 * TanStack 캐시는 메모리에만 있어서 새로고침하면 통째로 날아간다 — 내 정보도 마이페이지도
 * 매번 처음부터 받고, 그 동안 스켈레톤을 본다. 그런데 이 값들은 **지난 값을 먼저 보여 줘도
 * 되는 것들**이다: 뒤에서 다시 받아 조용히 바꾸면 된다 (stale-while-revalidate).
 *
 * **캐시만 믿고 안 받지는 않는다.** 프로필에는 `isOnline`·`nowPlaying` 처럼 지금 이 순간의
 * 값이 섞여 있다. 저장한 값은 "첫 화면을 채우는 용도" 일 뿐이고, 갱신은 평소대로 쿼리가 한다.
 * `hydrate` 는 `dataUpdatedAt` 을 비교하므로 이미 새 값이 도착했으면 옛 값으로 덮지 않는다.
 *
 * 새 패키지(`@tanstack/react-query-persist-client`)를 들이지 않는다 — 넣고 빼는 게 전부라
 * 코어가 내주는 `dehydrate`/`hydrate` 로 충분하다.
 */

/** 저장할 쿼리 (키 앞머리로 고른다). 여기 없는 것은 저장하지도 복원하지도 않는다 */
const PERSISTED: readonly (readonly string[])[] = [
  ["auth", "me"],
  ["user", "profile"],
  ["playlist", "mine"],
  ["playlist", "liked"],
];

/**
 * **`user.profile` 은 내 것만 저장한다** (S15P21A405-586).
 *
 * 프로필 안에는 `isOnline`·`nowPlaying` 처럼 **지금 이 순간의 값**이 섞여 있다. 남의 프로필까지
 * 저장하면 열어 본 사람 수만큼 쌓이고, 다시 열 때 **어제 값이 먼저 보인다** — 접속 중이 아닌
 * 사람이 접속 중으로, 안 듣는 곡이 듣는 중으로 한 박자 떠 있다가 바뀐다. 실시간이 고장 난
 * 것처럼 읽히는 종류다.
 *
 * 내 프로필은 다르다. 마이페이지의 첫 화면을 채우는 값이고, 내가 지금 접속해 있다는 것은
 * 화면을 보고 있다는 사실로 이미 참이다. 갱신은 평소대로 `staleTime: 0` 쿼리가 한다.
 */
function isPersistedProfile(key: readonly unknown[], myEmail: string | null): boolean {
  return myEmail != null && key[2] === myEmail;
}

/**
 * 이보다 오래된 값은 버린다. 하루 지난 팔로워 수를 잠깐이라도 사실처럼 띄우고 싶지는 않고,
 * 그쯤이면 다시 받는 편이 낫다.
 */
const MAX_AGE = 24 * 60 * 60 * 1000;

/** 저장이 몰리지 않게 묶는 간격(ms) — 쿼리 하나가 끝날 때마다 직렬화하면 아깝다 */
const THROTTLE = 1000;

interface Persisted {
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

/** 저장 후보인 갈래인가. 저장이 필요한지 **알아채는** 데 쓴다 (누구 것인지까지는 보지 않는다) */
function isPersistedFamily(key: readonly unknown[]): boolean {
  return PERSISTED.some((p) => p.every((part, i) => key[i] === part));
}

/** 실제로 저장할 것인가. 프로필은 여기서 내 것만 남는다 */
function isPersisted(key: readonly unknown[], myEmail: string | null): boolean {
  if (!isPersistedFamily(key)) return false;
  if (key[0] === "user" && key[1] === "profile") return isPersistedProfile(key, myEmail);
  return true;
}

export function clearPersistedQueries(): void {
  removeStorage(STORAGE_KEYS.queryCache);
}

/**
 * 저장해 둔 값을 캐시에 붓고, 이후 변화를 계속 저장한다. 되돌리는 함수를 준다.
 *
 * 마운트 뒤(`useEffect`)에 부른다 — 서버가 그린 HTML 과 첫 렌더가 달라지면 하이드레이션이
 * 어긋난다. 한 프레임 늦는 대신 요청 한 번을 기다리지 않아도 된다.
 */
export function startQueryPersist(queryClient: QueryClient): () => void {
  /** 지금 로그인한 사람. `auth.me` 가 아직 없으면 프로필은 이번 저장에서 빠진다 */
  const myEmail = () => queryClient.getQueryData<User>(QUERY_KEYS.auth.me)?.email ?? null;

  // 토큰이 없으면 남의 프로필일 수 있다 — 로그아웃 없이 세션만 끊긴 경우가 여기 걸린다
  if (!readStorage<string>(STORAGE_KEYS.accessToken)) {
    clearPersistedQueries();
    return () => {};
  }

  const saved = readStorage<Persisted>(STORAGE_KEYS.queryCache);
  if (saved && Date.now() - saved.savedAt < MAX_AGE) hydrate(queryClient, saved.state);
  else if (saved) clearPersistedQueries();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    writeStorage<Persisted>(STORAGE_KEYS.queryCache, {
      savedAt: Date.now(),
      // 실패한 쿼리는 담지 않는다 — 저장할 값이 없을 뿐 아니라 다음 방문에 오류 상태로 시작한다
      state: dehydrate(queryClient, {
        shouldDehydrateQuery: (q) => q.state.status === "success" && isPersisted(q.queryKey, myEmail()),
      }),
    });
  };

  // 저장 대상이 움직였을 때만 쓴다 — 캐시 이벤트는 지도·검색까지 전부 올라와서, 거르지 않으면
  // 바뀐 것도 없는데 1초마다 직렬화한다
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (timer || !isPersistedFamily(event.query.queryKey)) return;
    timer = setTimeout(save, THROTTLE);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
