/**
 * 별자리 콘테스트 **목** (S15P21A405-602). 배포 API 에 이 기능이 없다 — 백엔드 설계는
 * S15P21A405-548 · 598 에서 진행 중이고, 계약 초안은 BACKEND-NOTES "별자리 콘테스트" 절이다.
 * 백엔드가 생기면 `src/app/bff/contests/*` 만 갈아 끼우고 이 파일은 지운다.
 * **여기서 나온 점수·순위를 지표나 시연의 근거로 쓰면 안 된다.**
 *
 * 별밭은 **레이어 0 상주 집합**이다. 백엔드가 켜져 있으면 진짜 곡을 받아 쓴다 — 그래야
 * 곡 ID 가 진짜라서 "내 플리로 가져오기" 가 실제 플레이리스트로 이어진다. 목이면 `allSongs()`.
 */
import { CONTEST_DEFAULT_RULES } from "@/constants";
import { backendGet, isBackendEnabled, toResidentPoint, type BackendMapPoint } from "@/lib/backend";
import type { ApiErrorCode, Contest, ContestEntry, ContestJudge, ContestMatch, ContestSort, ContestTrack, MapPoint, MatchQuality, SketchPoint } from "@/types";
import { seeded } from "./seed";
import { allSongs } from "./songs";

export class ContestMockError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ------------------------------------------------------------------ 별밭
let field: Promise<MapPoint[]> | null = null;

async function loadField(): Promise<MapPoint[]> {
  if (!isBackendEnabled()) return allSongs().filter((s) => !s.ghostOnly);
  const res = await backendGet<{ content: BackendMapPoint[] }>("/api/music/major?level=1");
  return res.content.map(toResidentPoint);
}

/** 레이어 0 별밭. 한 번 받아 두고 재사용한다. 백엔드가 죽어 있으면 목 곡으로 내려간다 */
export function starField(): Promise<MapPoint[]> {
  if (!field) {
    field = loadField().catch(() => {
      field = null;
      return allSongs().filter((s) => !s.ghostOnly);
    });
  }
  return field;
}

// ------------------------------------------------------------------ 회차
const CONTEST = {
  id: 3,
  roundNo: 3,
  theme: "고양이",
  startsAt: "2026-09-20T00:00:00.000Z",
  endsAt: "2026-09-26T14:59:59.000Z",
  announceAt: "2026-09-27T03:00:00.000Z",
  status: "OPEN" as const,
  rules: { ...CONTEST_DEFAULT_RULES },
};

interface StoredEntry {
  id: number;
  title: string;
  ownerEmail: string;
  ownerNickname: string;
  tracks: ContestTrack[];
  closed: boolean;
  aiScore: number | null;
  aiComment: string | null;
  resubmitCount: number;
  saveCount: number;
  createdAt: string;
}

const entries = new Map<number, StoredEntry>();
/** 출품작 id → 표를 준 사람 이메일 */
const votes = new Map<number, Set<string>>();
/** 출품작 id → 가져간 사람 이메일 */
const saves = new Map<number, Set<string>>();
let nextEntryId = 100;

// ------------------------------------------------------------------ 매칭 (S15P21A405-598 의 목)
/** 중심을 빼고 가장 먼 점이 1 이 되게 맞춘다. 캔버스 y(아래 양수) → 배치 y(위 양수) */
function normalizeSketch(points: SketchPoint[]) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const raw = points.map((p) => ({ x: p.x - cx, y: -(p.y - cy) }));
  const r = Math.max(1e-6, ...raw.map((p) => Math.hypot(p.x, p.y)));
  return raw.map((p) => ({ x: p.x / r, y: p.y / r }));
}

function hashPoints(points: SketchPoint[]) {
  let h = 17;
  for (const p of points) h = (h * 31 + Math.round(p.x * 1000) * 7 + Math.round(p.y * 1000)) >>> 0;
  return h;
}

/** 곡들의 pc1·pc2 를 -1~1 로 누른다 (같은 배율, 중심 이동) — 배치 API 와 같은 규약 */
function layoutOf(songs: MapPoint[]): ContestTrack[] {
  const xs = songs.map((s) => s.pc[0]);
  const ys = songs.map((s) => s.pc[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(1e-6, ...xs.map((x) => Math.abs(x - cx)), ...ys.map((y) => Math.abs(y - cy)));
  return songs.map((s) => ({ musicId: s.musicId, title: s.title, artist: s.artist, x: (s.pc[0] - cx) / span, y: (s.pc[1] - cy) / span }));
}

/**
 * 그린 점과 닮은 배치의 곡을 찾는다. 이동·회전·균일 확대에 무관하게 비교한다 (반전은 제외).
 *
 * ponytail: 회전 8 × 위치 12 × 배율 3 후보를 전부 훑는 완전 탐색이다. 곡 1~4천 × 점 20 이면
 * 수천만 번 비교라 수십 ms 다. 실서비스(662만 곡)는 이대로 못 쓴다 — 백엔드 몫 (S15P21A405-598).
 */
export async function matchSketch(points: SketchPoint[]): Promise<ContestMatch> {
  const songs = await starField();
  const shape = normalizeSketch(points);
  const xs = songs.map((s) => s.pc[0]);
  const ys = songs.map((s) => s.pc[1]);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = Math.sqrt((mean(xs.map((x) => x * x)) - mean(xs) ** 2 + mean(ys.map((y) => y * y)) - mean(ys) ** 2) / 2) || 1;
  const rnd = seeded(hashPoints(points));

  let best: { cost: number; idx: number[] } = { cost: Infinity, idx: [] };
  for (let r = 0; r < 8; r++) {
    const a = (r * Math.PI) / 4;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    for (let k = 0; k < 12; k++) {
      const center = songs[Math.floor(rnd() * songs.length)];
      for (const sc of [0.35, 0.6, 1.0]) {
        const scale = sc * sd;
        const used = new Set<number>();
        const idx: number[] = [];
        let cost = 0;
        for (const p of shape) {
          const tx = center.pc[0] + (p.x * cos - p.y * sin) * scale;
          const ty = center.pc[1] + (p.x * sin + p.y * cos) * scale;
          let bi = -1;
          let bd = Infinity;
          for (let i = 0; i < songs.length; i++) {
            if (used.has(i)) continue;
            const d = (xs[i] - tx) ** 2 + (ys[i] - ty) ** 2;
            if (d < bd) {
              bd = d;
              bi = i;
            }
          }
          used.add(bi);
          idx.push(bi);
          cost += Math.sqrt(bd) / scale;
          if (cost >= best.cost) break;
        }
        if (idx.length === shape.length && cost < best.cost) best = { cost, idx };
      }
    }
  }

  const residual = best.cost / shape.length;
  const similarity = Math.max(0, Math.min(1, 1 - residual));
  const quality: MatchQuality = similarity >= 0.75 ? "HIGH" : similarity >= 0.5 ? "MID" : "LOW";
  return { tracks: layoutOf(best.idx.map((i) => songs[i])), similarity: Math.round(similarity * 100) / 100, quality };
}

// ------------------------------------------------------------------ AI 심사 (S15P21A405-548 의 목)
const COMMENTS: Record<0 | 30 | 60 | 80, string[]> = {
  0: ["아직 고양이라기엔 흐름이 보이지 않아요. 귀 두 개부터 잡아보면 어떨까요.", "선이 한 방향으로만 뻗어요. 얼굴 윤곽을 둥글게 돌려보세요."],
  30: ["둥근 얼굴은 보이는데 귀가 한쪽만 서 있어요.", "몸통은 고양이 같은데 머리가 어디인지 헷갈려요."],
  60: ["귀 두 개와 턱선이 살아 있어요. 수염 한 줄이면 완성이겠네요.", "앉아 있는 고양이 실루엣이에요. 꼬리를 이어주면 더 또렷해질 거예요."],
  80: ["뾰족한 귀, 동그란 얼굴, 꼬리까지. 이건 고양이가 맞아요.", "한눈에 고양이예요. 별 배치의 제약 속에서 잘 잡았어요."],
};

const judgeCache = new Map<string, ContestJudge>();

/**
 * 모양만 보고 0~100 을 매긴다. **결정적**이다 — 같은 배치면 같은 점수라 미리보기 점수 =
 * 출품 점수가 된다 (실서비스도 해시 캐시로 같은 성질을 보장해야 한다, BACKEND-NOTES 참고).
 * 휴리스틱: 점 개수 · 닫힘 · 가로세로 비 · 위쪽 봉우리 둘(=귀). 진짜 판정은 비전 모델 몫.
 */
export function judgeShape(tracks: ContestTrack[], closed: boolean): ContestJudge {
  const key = `${tracks.map((t) => t.musicId).join(",")}|${closed ? 1 : 0}`;
  const hit = judgeCache.get(key);
  if (hit) return hit;

  let h = 7;
  for (const t of tracks) h = (h * 31 + t.musicId) >>> 0;
  const xs = tracks.map((t) => t.x);
  const ys = tracks.map((t) => t.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const hgt = Math.max(...ys) - Math.min(...ys);
  const aspect = Math.min(w, hgt) / Math.max(w, hgt, 1e-6);
  const topY = Math.max(...ys);
  let peaks = 0;
  tracks.forEach((t, k) => {
    const a = tracks[(k + tracks.length - 1) % tracks.length];
    const b = tracks[(k + 1) % tracks.length];
    if (t.y > a.y && t.y > b.y && t.y > topY - hgt * 0.35) peaks++;
  });
  let s = 18 + Math.min(tracks.length, 14) * 2.5 + (closed ? 12 : 0) + aspect * 18 + (peaks >= 2 ? 16 : peaks === 1 ? 6 : 0) + (h % 13);
  s = Math.max(4, Math.min(97, Math.round(s)));
  const band = s >= 80 ? 80 : s >= 60 ? 60 : s >= 30 ? 30 : 0;
  const judge = { score: s, comment: COMMENTS[band][h % 2] };
  judgeCache.set(key, judge);
  return judge;
}

// ------------------------------------------------------------------ 시드 출품작
type Shape = [number, number][];
const CAT: Shape = [[-1, -0.2], [-1, 0.9], [-0.55, 0.35], [0.55, 0.35], [1, 0.9], [1, -0.2], [0.7, -0.9], [0, -1.1], [-0.7, -0.9]];
const CAT_TAIL: Shape = [...CAT, [-1.4, -0.9], [-1.8, -0.3]];
const FISH: Shape = [[-1, 0], [-0.3, 0.6], [0.6, 0.4], [1.1, 0.1], [1.5, 0.6], [1.5, -0.6], [1.1, -0.1], [0.6, -0.4], [-0.3, -0.6]];
const HEART: Shape = [[0, 0.9], [-0.8, 0.2], [-0.9, -0.5], [-0.45, -0.9], [0, -0.5], [0.45, -0.9], [0.9, -0.5], [0.8, 0.2]];
const LOAF: Shape = [[-1.2, 0.3], [-1, -0.6], [-0.6, -0.9], [0.9, -0.9], [1.3, -0.4], [1.2, 0.4], [0.6, 0.6], [-0.6, 0.6]];
const SCRIBBLE: Shape = Array.from({ length: 12 }, (_, i) => [Math.cos(i * 1.7) * (1 + i * 0.05), Math.sin(i * 2.3) * (1 - i * 0.03)]);

/** 도형 좌표(-2~2, y 위) → 캔버스 점(0~1, y 아래) */
const toSketch = (shape: Shape): SketchPoint[] => shape.map(([u, v]) => ({ x: (u + 2) / 4, y: (2 - v) / 4 }));

const MIN = 60_000;
const SEEDS: { title: string; email: string; nick: string; shape: Shape; ai: number; votes: number; saves: number; agoMin: number; q: string }[] = [
  { title: "창가의 회색 고양이", email: "seolhae@ody.app", nick: "seolhae", shape: CAT_TAIL, ai: 91, votes: 48, saves: 23, agoMin: 2 * 24 * 60, q: "뾰족한 귀 두 개와 옆으로 흐르는 꼬리까지. 이건 고양이가 맞아요." },
  { title: "식빵 굽는 중", email: "minkyu@ody.app", nick: "minkyu.j", shape: LOAF, ai: 74, votes: 61, saves: 41, agoMin: 40 * 60, q: "웅크린 등선이 살아 있어요. 귀가 조금만 서 있으면 완성이겠네요." },
  { title: "밤 낚시", email: "ocean@ody.app", nick: "oceanroom", shape: FISH, ai: 22, votes: 77, saves: 12, agoMin: 30 * 60, q: "지느러미와 꼬리가 뚜렷한 물고기예요. 고양이가 좋아할 것 같긴 합니다." },
  { title: "Slow Blink", email: "hana@ody.app", nick: "hana_k", shape: CAT, ai: 83, votes: 35, saves: 17, agoMin: 6 * 60, q: "얼굴 윤곽이 동그랗고 귀가 대칭이에요. 눈 두 점이 있었으면 더 좋았을 거예요." },
  { title: "하트인데요", email: "dooboo@ody.app", nick: "dooboo", shape: HEART, ai: 12, votes: 29, saves: 4, agoMin: 20 * 60, q: "하트로 보여요. 고양이의 흔적은 찾지 못했습니다." },
  { title: "고양이 아님 주의", email: "jjy@ody.app", nick: "jjy", shape: SCRIBBLE, ai: 31, votes: 9, saves: 1, agoMin: 3 * 60, q: "선이 얽혀서 형태가 잡히지 않아요. 왼쪽 위 뾰족한 부분은 귀로 읽힙니다." },
  { title: "옥상 고양이", email: "roof@ody.app", nick: "roofline", shape: CAT, ai: 66, votes: 22, saves: 9, agoMin: 25, q: "귀는 확실한데 턱선이 평평해서 상자에 담긴 고양이처럼 보여요." },
  { title: "골목 끝", email: "lune@ody.app", nick: "lune.ar", shape: CAT_TAIL, ai: 58, votes: 14, saves: 6, agoMin: 12 * 60, q: "전체 실루엣은 고양이인데 꼬리가 몸에서 떨어져 있어요." },
];

let seeding: Promise<void> | null = null;
/** 첫 요청에 한 번 심는다. 매칭이 별밭(비동기)을 필요로 해서 모듈 로드 시점에 못 한다 */
function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      const now = Date.now();
      for (const [i, s] of SEEDS.entries()) {
        // 시드마다 다른 자리에 놓이게 점을 살짝 흔든다 — 같은 도형이 같은 곡으로 겹치지 않게
        const jitter = seeded(1000 + i);
        const pts = toSketch(s.shape).map((p) => ({ x: p.x + (jitter() - 0.5) * 0.02, y: p.y + (jitter() - 0.5) * 0.02 }));
        const match = await matchSketch(pts);
        const id = i + 1;
        entries.set(id, {
          id,
          title: s.title,
          ownerEmail: s.email,
          ownerNickname: s.nick,
          tracks: match.tracks,
          closed: true,
          aiScore: s.ai,
          aiComment: s.q,
          resubmitCount: 0,
          saveCount: s.saves,
          createdAt: new Date(now - s.agoMin * MIN).toISOString(),
        });
        // 표는 익명 계정들이 준 것으로 채운다 — 내 표는 아직 없다
        votes.set(id, new Set(Array.from({ length: s.votes }, (_, k) => `voter${k}@ody.app`)));
        saves.set(id, new Set());
      }
    })();
  }
  return seeding;
}

// ------------------------------------------------------------------ 조회
const votesBy = (me: string) => [...votes.values()].filter((set) => set.has(me)).length;
const myEntry = (me: string) => [...entries.values()].find((e) => e.ownerEmail === me) ?? null;

export async function currentContest(me: string): Promise<Contest> {
  await ensureSeeded();
  const mine = myEntry(me);
  return {
    ...CONTEST,
    myEntryId: mine?.id ?? null,
    myVotesLeft: Math.max(0, CONTEST.rules.voteLimit - votesBy(me)),
    myResubmitsLeft: Math.max(0, CONTEST.rules.resubmitLimit - (mine?.resubmitCount ?? 0)),
  };
}

function toEntry(e: StoredEntry, me: string, maxVotes: number): Omit<ContestEntry, "rank"> {
  const voteCount = votes.get(e.id)?.size ?? 0;
  const eligible = e.aiScore != null && e.aiScore >= CONTEST.rules.aiGate;
  return {
    id: e.id,
    contestId: CONTEST.id,
    title: e.title,
    ownerEmail: e.ownerEmail,
    ownerNickname: e.ownerNickname,
    tracks: e.tracks,
    closed: e.closed,
    aiScore: e.aiScore,
    aiComment: e.aiComment,
    voteCount,
    saveCount: e.saveCount,
    finalScore: eligible && e.aiScore != null ? Math.round((e.aiScore * 0.5 + (voteCount / maxVotes) * 100 * 0.5) * 10) / 10 : null,
    eligible,
    votedByMe: votes.get(e.id)?.has(me) ?? false,
    savedByMe: saves.get(e.id)?.has(me) ?? false,
    isMine: e.ownerEmail === me,
    createdAt: e.createdAt,
  };
}

const SORTERS: Record<ContestSort, (a: ContestEntry, b: ContestEntry) => number> = {
  latest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  votes: (a, b) => b.voteCount - a.voteCount || (b.aiScore ?? -1) - (a.aiScore ?? -1),
  ai: (a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1) || b.voteCount - a.voteCount,
  final: (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.aiScore ?? -1) - (a.aiScore ?? -1),
  saves: (a, b) => b.saveCount - a.saveCount || b.voteCount - a.voteCount,
};

export async function listEntries(me: string, sort: ContestSort): Promise<ContestEntry[]> {
  await ensureSeeded();
  const maxVotes = Math.max(1, ...[...votes.values()].map((s) => s.size));
  const base = [...entries.values()].map((e) => toEntry(e, me, maxVotes));
  // 순위: 대상만, 최종 점수 내림차순 → AI → 먼저 낸 순
  const ranked = base
    .filter((e) => e.eligible)
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0) || (b.aiScore ?? 0) - (a.aiScore ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const rankOf = new Map(ranked.map((e, i) => [e.id, i + 1]));
  return base.map((e) => ({ ...e, rank: rankOf.get(e.id) ?? null })).sort(SORTERS[sort]);
}

// ------------------------------------------------------------------ 쓰기
function assertOpen() {
  if (CONTEST.status !== "OPEN") throw new ContestMockError("CONTEST_NOT_OPEN", 409, "접수가 끝난 회차입니다.");
}

export async function submitEntry(me: string, nickname: string, input: { title: string; tracks: ContestTrack[]; closed: boolean }): Promise<ContestEntry> {
  await ensureSeeded();
  assertOpen();
  const prev = myEntry(me);
  if (prev && prev.resubmitCount >= CONTEST.rules.resubmitLimit) throw new ContestMockError("CONTEST_RESUBMIT_EXHAUSTED", 409, "다시 출품할 수 있는 횟수를 모두 썼습니다.");
  const judge = judgeShape(input.tracks, input.closed);
  const id = prev?.id ?? nextEntryId++;
  entries.set(id, {
    id,
    title: input.title,
    ownerEmail: me,
    ownerNickname: nickname,
    tracks: input.tracks,
    closed: input.closed,
    aiScore: judge.score,
    aiComment: judge.comment,
    resubmitCount: prev ? prev.resubmitCount + 1 : 0,
    saveCount: prev?.saveCount ?? 0,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  });
  if (!votes.has(id)) votes.set(id, new Set());
  if (!saves.has(id)) saves.set(id, new Set());
  const list = await listEntries(me, "latest");
  return list.find((e) => e.id === id)!;
}

export async function vote(me: string, entryId: number, on: boolean): Promise<{ voteCount: number; myVotesLeft: number }> {
  await ensureSeeded();
  assertOpen();
  const e = entries.get(entryId);
  if (!e) throw new ContestMockError("CONTEST_ENTRY_NOT_FOUND", 404, "없는 출품작입니다.");
  if (e.ownerEmail === me) throw new ContestMockError("CONTEST_VOTE_SELF", 400, "내 출품작에는 표를 줄 수 없습니다.");
  const set = votes.get(entryId)!;
  if (on) {
    if (!set.has(me) && votesBy(me) >= CONTEST.rules.voteLimit) throw new ContestMockError("CONTEST_VOTE_LIMIT", 409, "표를 모두 썼습니다. 다른 별자리의 표를 거두면 다시 줄 수 있습니다.");
    set.add(me);
  } else set.delete(me);
  return { voteCount: set.size, myVotesLeft: Math.max(0, CONTEST.rules.voteLimit - votesBy(me)) };
}

export async function findEntry(entryId: number): Promise<StoredEntry> {
  await ensureSeeded();
  const e = entries.get(entryId);
  if (!e) throw new ContestMockError("CONTEST_ENTRY_NOT_FOUND", 404, "없는 출품작입니다.");
  return e;
}

/** 가져가기 기록. 플레이리스트 자체는 라우트가 만든다 (백엔드 create) — **만들어진 뒤에** 부른다 */
export async function markSaved(me: string, entryId: number): Promise<StoredEntry> {
  const e = await findEntry(entryId);
  const set = saves.get(entryId)!;
  if (!set.has(me)) {
    set.add(me);
    e.saveCount++;
  }
  return e;
}

export function contestIdMatches(id: number) {
  return id === CONTEST.id;
}
