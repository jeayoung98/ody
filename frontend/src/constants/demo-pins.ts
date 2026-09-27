/**
 * **시연 곡 고정** (S15P21A405-717, 사용자 결정).
 *
 * 시연에서 트는 곡은 지도에서 **언제나 앨범 커버로, 가장 크게, 맨 앞에** 보여야 한다. 커버는 원래
 * `render/draw-map.ts` `drawCovers` 가 겹 대표곡 중 화면 칸마다 하나씩 고르므로 특정 곡이 뜬다는 보장이
 * 없고, 겹을 바꾸면 상주 집합에서 빠져 좌표조차 없어진다. 여기 적힌 곡은 그 규칙 밖이다 —
 * 엔진이 모든 겹에서 상주로 남기고 깊이를 최전면으로 못 박는다 (`MapEngine.setDemoIds`).
 *
 * **id 가 아니라 제목·아티스트다.** 지도 응답과 검색은 곡을 `musicId` 로만 가리키는데, 이 목록을 적을 때
 * 백엔드 검색이 401(A-17 원복)이라 id 를 확인할 수 없었다. 그래서 앱이 켜질 때 검색으로 찾는다
 * (`hooks/use-demo-pins.ts`). id 를 알게 되면 `id` 를 채우면 되고, 그러면 검색을 건너뛴다. ELEVEN 은 동명 곡에
 * 잘못 붙어서 id 로 고정했다 (아래 목록).
 *
 * 검색은 통합 검색(`q=`) 한 번이고, 결과에서 제목이 같고(대소문자·공백 무시) 아티스트가 맞는 첫 곡을
 * 고른다 (`matchDemoSong`). 못 찾으면 그 곡만 조용히 빠진다 — 시연 곡 하나 때문에 지도가 멈추면 안 된다.
 */
export interface DemoSong {
  /** 확정된 musicId. 있으면 검색하지 않는다 */
  id?: number;
  /** 검색어이자 제목 대조 기준 */
  title: string;
  /** 아티스트 대조(낱말 단위 일치, 대소문자 무시 — `hasWord`). 여럿이면 하나만 맞으면 된다. 없으면 제목만 본다 */
  artist?: string | string[];
}

export const DEMO_SONGS: readonly DemoSong[] = [
  { title: "Cayendo (Side A - Acoustic)", artist: "Frank Ocean" },
  { title: "PICK ME", artist: "PRODUCE 101" },
  { title: "Let's Play House", artist: "Parliament" },
  { title: "Plier", artist: "Wizzo" },
  { title: "Hollywood Action" },
  { title: "REDRED", artist: ["코르티스", "CORTIS"] },
  /*
    ELEVEN 은 **id 로 고정한다** (S15P21A405-717). 제목·아티스트로 찾았더니 "IVE" 가 "Ancient River" 의 r-ive-r 에
    부분 일치로 걸려 그 곡의 ELEVEN 이 커졌다(대조는 이제 낱말 단위다 — `hasWord`). 동명 곡이 많아 검색 결과에 IVE 곡이
    안 실리면 제목만 맞는 곡으로 떨어질 수도 있어서 검색 자체를 건너뛴다. 10000940 은 지도 데이터의 IVE "ELEVEN" 이다
  */
  { id: 10000940, title: "ELEVEN", artist: ["아이브", "IVE"] },
  { title: "BAD", artist: ["에이티즈", "ATEEZ"] },
];

export const DEMO_PIN = {
  /**
   * 시연 곡의 깊이 z. 별 깊이는 -1~1 이고 1 이 가장 가깝다 — 그 끝에 세워 시차·크기 모두 최전면이 된다.
   * 1 을 넘기면 `STAR_VIEW.parallax` 로 화면을 끌 때 다른 별보다 튀어 따로 논다.
   */
  z: 1,
  /**
   * 커버 한 변에 더 곱하는 배율. z=1 만으로는 해시가 우연히 1 근처인 곡과 같은 크기라 "가장 크다" 가 안 된다.
   * 1.35 로 시작했는데 실제 화면에서 너무 컸다(사용자 피드백) — 34px × 1.3(깊이) × 1.15 ≈ 51px,
   * 최소 간격(54px) 안에 들어와 옆 커버를 덮지 않으면서도 일반 커버(최대 44px)보다는 또렷이 크다.
   */
  coverGrow: 1.15,
} as const;

/** 제목 비교용 — 대소문자·앞뒤 공백·연속 공백을 무시한다. 백엔드 제목 표기 흔들림을 흡수한다 */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * `hay` 안에 `word` 가 **낱말로** 들어 있나 — 앞뒤가 글자·숫자가 아니어야 한다 (S15P21A405-717).
 * 그냥 부분 일치로 보면 "ive" 가 "ancient river" 의 r-ive-r 에 걸린다. 괄호 표기("ive (아이브)")는 괄호·빈칸이
 * 경계라 그대로 잡힌다
 */
function hasWord(hay: string, word: string): boolean {
  if (!word) return false;
  const isChar = (c: string) => /[\p{L}\p{N}]/u.test(c);
  for (let i = hay.indexOf(word); i >= 0; i = hay.indexOf(word, i + 1)) {
    const before = i > 0 ? hay[i - 1] : "";
    const after = hay[i + word.length] ?? "";
    if (!isChar(before) && !isChar(after)) return true;
  }
  return false;
}

/**
 * 검색 결과에서 시연 곡을 고른다. 제목이 같고 아티스트가 맞는 첫 곡, 없으면 제목만 맞는 첫 곡, 그것도 없으면 null.
 * 아티스트는 낱말 단위로 맞춘다(`hasWord`).
 * 아티스트가 안 맞는 동명 곡으로 떨어질 때는 **제목 후보가 하나뿐일 때만** — 여럿이면 어느 것인지 모르므로 안 고른다.
 */
export function matchDemoSong<T extends { title: string; artist: string | null }>(want: DemoSong, items: readonly T[]): T | null {
  const title = norm(want.title);
  const artists = (Array.isArray(want.artist) ? want.artist : want.artist ? [want.artist] : []).map(norm);
  const byTitle = items.filter((it) => norm(it.title) === title);
  if (!byTitle.length) return null;
  if (!artists.length) return byTitle[0];
  const hit = byTitle.find((it) => {
    const a = norm(it.artist ?? "");
    return a.length > 0 && artists.some((w) => hasWord(a, w) || hasWord(w, a));
  });
  if (hit) return hit;
  return byTitle.length === 1 ? byTitle[0] : null;
}
