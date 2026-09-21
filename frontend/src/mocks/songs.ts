/**
 * 목 곡 데이터셋 — 16차원 PC 벡터를 가진 곡 N개.
 * 별지도/모프 프로토타입의 생성 규칙을 따른다: 밀도 봉우리 22개 주변에 군집, 장르는 색·성향으로만.
 * 여기는 **우주 전체**(카탈로그)다 — 겹의 상주 집합은 /bff/map/songs 라우트가 이 중에서 골라 내려준다.
 */
import { GENRE_NAMES, LAYER_SONG_COUNT, NO_GENRE_ID } from "@/constants";
import { PC_DIMS, type MapPoint } from "@/types";
import { seeded } from "./seed";

/**
 * 목 우주 전체의 곡 수. **한 겹 규모(LAYER_SONG_COUNT)보다 커야** 겹마다 다른 집합이 내려간다 —
 * 같으면 어느 겹에서나 전곡이 상주해서 "겹마다 받는다"가 확인되지 않는다.
 * 실서비스는 662만 곡 중 한 겹에 1,000곡이다.
 */
export const SONG_COUNT = LAYER_SONG_COUNT * 4;
export { GENRE_NAMES };
export const MOODS = ["몽환적", "신나는", "잔잔한", "어두운", "따뜻한", "차가운"];

const TA = ["Neon", "Velvet", "Glass", "Static", "Marble", "Paper", "Salt", "Ember", "Cobalt", "Hollow", "Amber", "Sable", "Quiet", "Rust", "Linen", "Ivory", "Bitter", "Solar", "Midnight", "Pale", "Copper", "Cinder", "Frost", "Iron"];
const TB = ["Orbit", "Harbor", "Signal", "Garden", "Circuit", "Chapel", "Freeway", "Tundra", "Parade", "Anthem", "Lantern", "Current", "Drift", "Wire", "Bloom", "Alley", "Echo", "Basin", "Cassette", "Vapor", "Corridor", "Mirror", "Tide", "Ledge"];
const TK = ["새벽 세 시", "유리창", "환승", "막차 정류장", "겨울잠", "먼 불빛", "빈 방", "수면 아래", "오후 네 시", "회전목마", "물결", "야간버스", "흰 소음", "손끝", "장마", "불면", "기억의 방", "저편", "해질목", "진동", "백색 정원", "여름의 끝"];
const AA = ["Low", "Velour", "Kite", "Palm", "Nocturne", "Sable", "Hyper", "Slow", "Ghost", "Neon", "Paper", "Vault", "Mono", "Halcyon", "Cobalt", "Silt", "Terra", "Vellum"];
const AB = ["Division", "Sisters", "Machine", "Society", "Bureau", "Choir", "Club", "Collective", "Ensemble", "Orchestra", "Youth", "Motel", "Trio", "Signal", "Union", "Company"];
const AK = ["새벽차", "도시선", "청음", "미러볼", "유리도시", "밤편지", "전기양", "목요일", "서브웨이", "화요일의 방", "백야", "소음정원"];

let cache: MapPoint[] | null = null;

/** 결정적으로 생성된 곡 전체. 서버(API 라우트)와 목 헬퍼가 공유 */
export function allSongs(): MapPoint[] {
  if (cache) return cache;
  const rnd = seeded(20260902);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 1.6;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  // 밀도 봉우리 (이름 없음, 색 성향만)
  const cells = Array.from({ length: 22 }, () => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    // 색이 보여야 하는 목이라 '무장르'는 뽑지 않는다 (실데이터는 99%가 무장르다 — BACKEND-NOTES A-1)
    const gi = Math.floor(rnd() * NO_GENRE_ID);
    const w = Array.from({ length: NO_GENRE_ID }, () => 0.75 + rnd() * 0.5);
    w[gi] += 1.9;
    const tot = w.reduce((p, v) => p + v, 0);
    return { x: Math.cos(a) * r * 1.16, y: Math.sin(a) * r * 0.72, w: w.map((v) => v / tot), gi };
  });
  const pickGenre = (c: (typeof cells)[number]) => {
    let t = rnd();
    for (let g = 0; g < c.w.length; g++) {
      t -= c.w[g];
      if (t <= 0) return g;
    }
    return c.gi;
  };
  const nearestCell = (x: number, y: number) => {
    let best = cells[0];
    let bd = 1e9;
    for (const c of cells) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  };

  const raw: { x: number; y: number; gi: number; mag: number; rest: number[] }[] = [];
  const push = (x: number, y: number, gi: number) => {
    raw.push({ x, y, gi, mag: Math.pow(rnd(), 0.95), rest: Array.from({ length: PC_DIMS - 2 }, () => gauss() * 0.8) });
  };
  const scatter = () => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = Math.cos(a) * r * 1.3;
    const y = Math.sin(a) * r * 0.82;
    push(x, y, pickGenre(nearestCell(x, y)));
  };
  // ① 구름 전체에 고르게 (55%)
  for (let i = 0; i < Math.round(SONG_COUNT * 0.55); i++) scatter();
  // ② 봉우리 주변 (45%)
  for (const c of cells) {
    const n = Math.round(((SONG_COUNT * 0.45) / cells.length) * (0.7 + rnd() * 0.7));
    for (let i = 0; i < n; i++) push(c.x + gauss() * 0.14, c.y + gauss() * 0.12, pickGenre(c));
  }
  // 봉우리 표본 수가 난수라 총합이 어긋난다 — 정확히 맞춘다.
  // 한 자리는 확인용 고스트곡이 차지하므로 하나 적게 만든다
  while (raw.length < SONG_COUNT - 1) scatter();
  raw.length = SONG_COUNT - 1;

  // 축별 표준화 (z-score) → 모든 레이어가 같은 스케일
  const dims: number[][] = Array.from({ length: PC_DIMS }, () => []);
  raw.forEach((s) => {
    dims[0].push(s.x);
    dims[1].push(s.y);
    s.rest.forEach((v, i) => dims[i + 2].push(v));
  });
  const stats = dims.map((arr) => {
    const m = arr.reduce((p, v) => p + v, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((p, v) => p + (v - m) ** 2, 0) / arr.length) || 1;
    return { m, sd };
  });

  cache = raw.map((s, i) => {
    const vals = [s.x, s.y, ...s.rest];
    const pc = vals.map((v, d) => Math.round(((v - stats[d].m) / stats[d].sd) * 1000) / 1000);
    const kr = rnd();
    const title = kr < 0.34 ? pick(TK) : `${pick(TA)} ${pick(TB)}`;
    const artist = kr < 0.3 ? pick(AK) : `${pick(AA)} ${pick(AB)}`;
    // 실서비스는 백엔드가 만들어 준다 (규칙 6: 검색 URL 만). 목은 모양만 맞춘다
    const playable = rnd() > 0.115;
    return {
      musicId: i + 1,
      pc,
      genreId: s.gi,
      weight: Math.round(Math.pow(10, 2.6 + s.mag * 4.2)),
      title,
      artist,
      youtubeUrl: playable ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title}`)}` : null,
      playable,
    };
  });
  cache.push(ghostOnlySong());
  return cache;
}

/**
 * 목 확인용 곡 — **최상단 겹(레이어 0)에만** 있고 그 아래 겹에는 없다.
 * 그래서 깊은 겹에서 검색하면 고스트별로 뜨고, "이 별로 이동" 을 누르면 레이어 0 에서 실제 별로 보인다 (MAP-12).
 * 좌표는 구름 바깥이라 "저쪽 바깥에 있다"는 방향이 잘 읽힌다.
 */
function ghostOnlySong(): MapPoint {
  return {
    musicId: SONG_COUNT,
    pc: [2.6, 1.7, ...Array.from({ length: PC_DIMS - 2 }, (_, i) => (i % 2 ? -1.4 : 1.9))],
    genreId: 2,
    weight: 48_000,
    title: "고스트별",
    artist: "다른 갈래",
    youtubeUrl: "https://www.youtube.com/results?search_query=%EA%B3%A0%EC%8A%A4%ED%8A%B8%EB%B3%84",
    playable: true,
    ghostOnly: true,
  };
}

export function songById(id: number): MapPoint | undefined {
  const list = allSongs();
  return id >= 1 && id <= list.length ? list[id - 1] : undefined;
}

/** 16차원 임베딩 거리 (PC1·PC2 는 좌표 스케일이라 비중을 낮춘다) */
export function embDist(a: MapPoint, b: MapPoint): number {
  let d = 0;
  for (let i = 0; i < PC_DIMS; i++) {
    const t = (a.pc[i] - b.pc[i]) * (i < 2 ? 1 / 3 : 1);
    d += t * t;
  }
  return Math.sqrt(d);
}

/** 유사도 Top N (자기 자신 제외) */
export function nearestSongs(center: MapPoint, n: number): MapPoint[] {
  return allSongs()
    .filter((s) => s.musicId !== center.musicId)
    .map((s) => ({ s, d: embDist(center, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.s);
}


