import type { Id } from "@/types";

/** 누른 순간 화면이 이미 알고 있던 것. 상세 조회가 돌아오기 전까지 이걸 보여 준다 */
export interface MusicHint {
  title: string;
  artist: string | null;
}

/** 힌트로 넘길 수 있는 최소 모양. 검색 결과·지도 별·플리 곡이 전부 이걸 만족한다 */
export interface MusicHintInput {
  id: Id;
  title: string;
  artist?: string | null;
}

/**
 * 들고 있을 힌트 수. 넘치면 넣은 순서대로 버린다.
 *
 * 필요한 것은 **지금 큐에 있는 곡 + 여정 두 칸**뿐이라 이보다 훨씬 적어도 되지만, 항목 하나가
 * 짧은 문자열 둘이라 512개를 다 채워도 수십 KB다. 긴 플리를 통째로 넘겨도 앞 곡이 밀려나지
 * 않을 만큼만 잡았다.
 */
const MAX_HINTS = 512;

const hints = new Map<number, MusicHint>();
const listeners = new Set<() => void>();

/**
 * **곡 제목을 낙관적으로 보여 주기 위한 힌트 캐시** (S15P21A405-585).
 *
 * 제목을 쓰는 자리(재생바·여정 출발/도착 칸)는 `useMusicDetailQuery` 하나만 보고 있어서,
 * 응답이 오기 전까지 `Track 12345` 가 보였다가 뒤늦게 진짜 제목으로 바뀌었다. 그런데
 * **누른 쪽은 이미 제목을 알고 있다** — 검색 결과 줄에도, 지도 별에도, 플리 목록에도
 * 제목과 아티스트가 그려져 있다. 그걸 여기 넘겨 두면 기다릴 이유가 없다.
 *
 * 상세 캐시(`QUERY_KEYS.music.detail`)에 직접 심지 않는 이유: 그 쿼리는 `staleTime: Infinity`
 * 라 한 번 심으면 **진짜 상세를 다시 받지 않는다.** 주성분 16개·주변 10곡이 빠진 반쪽짜리가
 * 영원히 남는다. 그래서 캐시를 건드리지 않고 옆에 둔다 — 상세가 도착하면 {@link resolveMusicLabel}
 * 이 그쪽을 쓴다.
 *
 * **Zustand 스토어가 아니다.** 앱 상태가 아니라 곁다리 캐시이고, 쓰는 자리가 세 군데(재생바·
 * 여정 칸 두 줄)뿐이다. 스토어로 두면 값을 바꿀 때마다 Map 을 통째로 복사해야 하는데 —
 * 긴 플리를 넘기면 그게 매번 수백 개 복사다 — 여기서는 제자리에서 고치고 구독자에게 알리기만
 * 한다. 읽는 쪽은 `useSyncExternalStore` 라 **자기 곡의 힌트가 바뀐 컴포넌트만** 다시 그린다.
 */
export function rememberMusicHints(songs: readonly MusicHintInput[]): void {
  let changed = false;
  for (const song of songs) {
    if (!song?.title) continue;
    const artist = song.artist ?? null;
    const prev = hints.get(song.id);
    if (prev && prev.title === song.title && prev.artist === artist) continue;
    hints.set(song.id, { title: song.title, artist });
    changed = true;
  }
  if (!changed) return;
  // Map 은 넣은 순서를 지킨다 — 넘치면 오래된 것부터 버린다
  while (hints.size > MAX_HINTS) hints.delete(hints.keys().next().value!);
  for (const listen of listeners) listen();
}

/**
 * 같은 곡이면 **같은 객체**를 준다. `useSyncExternalStore` 가 이 동일성으로 렌더를 거르므로,
 * 여기서 새 객체를 만들면 힌트 하나가 바뀔 때마다 이름표 전부가 다시 그려진다.
 */
export function getMusicHint(musicId: number | null): MusicHint | undefined {
  return musicId == null ? undefined : hints.get(musicId);
}

/** 서버 렌더에는 누른 적이 없다 — 늘 비어 있어야 하이드레이션이 어긋나지 않는다 */
export function getMusicHintOnServer(): undefined {
  return undefined;
}

export function subscribeMusicHints(listen: () => void): () => void {
  listeners.add(listen);
  return () => void listeners.delete(listen);
}

/** 테스트용 — 화면에서 비울 일은 없다 */
export function clearMusicHints(): void {
  hints.clear();
}

/** 테스트용 — 담고 있는 수 */
export function musicHintCount(): number {
  return hints.size;
}
