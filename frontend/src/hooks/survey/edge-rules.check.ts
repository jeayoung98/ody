/**
 * 간선 판정 자체 검사 (S15P21A405-335). 의존성 없이 돈다.
 *
 * ```bash
 * node frontend/src/hooks/survey/edge-rules.check.ts
 * ```
 *
 * S15P21A405-335 코멘트에 적힌 케이스를 그대로 옮겼다. 주변↔경로를 오가는 조합이 스무 개가
 * 넘어서 눈으로 좇는 것으로는 회귀를 못 잡는다. 규칙을 고치면 여기가 먼저 깨져야 한다.
 */
import assert from "node:assert/strict";
import { journeyEdge, nearbyEdge, type Trail } from "./edge-rules.ts";

const song = (musicId: number) => ({ musicId, title: `song${musicId}`, artist: null, genreId: null });
const A = 1, B = 2, C = 3, D = 4, E = 5;

/** 들은 곡·못 들려준 곡으로 자취를 만든다. 마지막 원소가 `lastPlayed` 다 */
const trail = (played: number[], unplayable: number[] = []): Trail => ({
  played: new Set(played),
  lastPlayed: played.at(-1) ?? null,
  unplayable: new Set(unplayable),
});

const SID = "s1";
const nearbyList = { sessionId: SID, center: song(A), neighbors: [song(B), song(C), song(D)] };
const journeyList = { sessionId: SID, stops: [song(A), song(B), song(C), song(D)] };

const near = (musicId: number, t: Trail) => nearbyEdge(musicId, t, nearbyList);
const jour = (musicId: number, t: Trail) => journeyEdge(musicId, t, journeyList);

// ── 주변 탐색 ────────────────────────────────────────────────────────────────
// 기준곡을 듣고 이웃을 들으면 묻는다
assert.equal(near(B, trail([A]))?.target.prevMusicId, undefined, "주변은 prev 를 안 보낸다");
assert.equal(near(B, trail([A]))?.target.anchorMusicId, A);
assert.equal(near(B, trail([A]))?.target.rank, 1);

// 결정 1 — 기준곡이 직전 곡이 아니어도 묻는다. 이웃 10곡이 전부 평가돼야 한다
assert.ok(near(C, trail([A, B])), "A→C: 직전이 B 여도 기준곡 A 로 묻는다");
assert.ok(near(D, trail([A, B, C])), "A→D: 셋째 이웃도 평가된다");
assert.equal(near(D, trail([A, B, C]))?.target.rank, 3);

// 기준곡을 선택만 하고 안 들었으면 그 탐색은 통째로 무효 (케이스 3-2)
assert.equal(near(B, trail([])), null, "기준곡을 안 들으면 안 묻는다");

// 재생 불가 — 기준곡이 못 들려준 곡이면 전부 무효, 이웃 하나가 불가면 그 하나만 빠진다
assert.equal(near(B, trail([A], [A])), null, "기준곡 재생 불가 → 전부 무효");
assert.equal(near(B, trail([A], [B])), null, "그 이웃만 빠진다");
assert.ok(near(C, trail([A], [B])), "나머지 이웃은 그대로 묻는다");

// 이웃 목록 밖의 곡은 이 탐색과 무관하다
assert.equal(near(E, trail([A])), null, "이웃이 아니면 안 묻는다");

// ── 경로 탐색 ────────────────────────────────────────────────────────────────
// 순서대로 들으면 바로 앞 역과 비교한다
assert.equal(jour(B, trail([A]))?.target.prevMusicId, A);
assert.equal(jour(C, trail([A, B]))?.target.prevMusicId, B, "결정 2 — 비교 상대는 직전 곡");
assert.equal(jour(C, trail([A, B]))?.target.rank, 2);
assert.equal(jour(C, trail([A, B]))?.target.anchorMusicId, A, "anchor 는 출발곡");
assert.equal(jour(C, trail([A, B]))?.target.targetMusicId, D, "target 은 도착곡");

// 출발곡은 앞 역이 없다
assert.equal(jour(A, trail([])), null, "출발곡은 평가 대상이 아니다");

// 케이스 2-예1 — 냅다 건너뛰면 제안한 간선이 아니다
assert.equal(jour(D, trail([A])), null, "A→D 건너뛰기는 안 묻는다");

// 케이스 2-예2 — 역순
assert.equal(jour(C, trail([D])), null, "D→C 역순은 안 묻는다");
assert.equal(jour(B, trail([D, C])), null, "역순으로 계속 가도 안 묻는다");

// 케이스 2-예4 — 못 들려준 역은 없는 셈 치고 이어붙인다
assert.equal(jour(C, trail([A], [B]))?.target.prevMusicId, A, "B 가 재생 불가면 A→C");
assert.equal(jour(D, trail([A], [B, C]))?.target.prevMusicId, A, "B·C 둘 다 불가면 A→D");
assert.equal(jour(C, trail([A], [B]))?.target.rank, 2, "rank 는 이어붙여도 정거장 번호 그대로");

// 이어붙이기는 **재생 불가일 때만**이다. 멀쩡한 역을 건너뛴 것과 섞이면 안 된다
assert.equal(jour(D, trail([A], [B])), null, "C 는 멀쩡한데 건너뛰었으면 안 묻는다");

// 평가 대상 자신이 재생 불가면 묻지 않는다
assert.equal(jour(B, trail([A], [B])), null, "못 들려준 곡은 평가 대상이 아니다");

// 경로 밖의 곡 (다른 탐색으로 이탈)
assert.equal(jour(E, trail([A, B])), null, "경로에 없는 곡은 안 묻는다");

console.log("edge-rules: 모든 케이스 통과");
