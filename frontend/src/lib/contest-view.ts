import type { SketchStep } from "@/constants/contest";
import type { Contest, ContestEntry, ContestSort, MatchQuality } from "@/types";

/**
 * 콘테스트 응답을 화면이 묻는 것으로 (S15P21A405-640). 순수 함수만 — `tests/contest-view.test.cjs` 가 묶는다.
 */

export type RoundPhase = "UPCOMING" | "OPEN" | "CLOSED";

/**
 * 회차가 지금 열려 있나. 백엔드 `ArtworkRound` 에는 상태 필드가 없고 기간만 있다 — `round/current` 가 `null` 이 아니면
 * 서버는 "열린 회차" 로 본 것이지만, 기간이 지난 뒤 캐시에 남은 값이나 시작 전 회차를 화면이 가려야 한다.
 */
export function roundPhase(round: Pick<Contest, "startsAt" | "endsAt">, now: number = Date.now()): RoundPhase {
  if (now < new Date(round.startsAt).getTime()) return "UPCOMING";
  if (now >= new Date(round.endsAt).getTime()) return "CLOSED";
  return "OPEN";
}

/**
 * 갤러리 정렬. 서버는 순위순(`rankScore` ↓ → `score` ↓ → 먼저 낸 순) 하나만 준다 — 나머지는 받아 온 한 페이지
 * 안에서만 다시 세운다. 원본 배열은 건드리지 않는다.
 */
export function sortEntries(items: readonly ContestEntry[], sort: ContestSort): ContestEntry[] {
  const list = [...items];
  switch (sort) {
    case "latest":
      return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case "likes":
      return list.sort((a, b) => b.likeCnt - a.likeCnt || (b.score ?? -1) - (a.score ?? -1));
    case "ai":
      return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.likeCnt - a.likeCnt);
    default:
      return list.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  }
}

/**
 * AI 추천 모양의 적합도를 그린 별자리의 "모양 일치도" 와 같은 0~100 척도로 (S15P21A405-595).
 * `fitError` 는 평균 어긋남 ÷ 템플릿 반폭이라 0 이 완벽, 1 이면 반폭만큼 어긋난 것 — 그 위는 0점으로 눌러 둔다.
 * 등급 문턱은 서버 `DrawResponse.quality` 와 같다 (HIGH ≥ 90 · MEDIUM ≥ 70).
 */
export function templateScore(fitError: number): { score: number; quality: MatchQuality } {
  const score = Math.round(Math.max(0, Math.min(1, 1 - fitError)) * 100);
  return { score, quality: score >= 90 ? "HIGH" : score >= 70 ? "MEDIUM" : "LOW" };
}

/** 작품 주인 표시 — 닉네임이 안 와서 이메일 앞부분을 쓴다 (BACKEND-NOTES A-83) */
export function ownerLabel(email: string | null, nickname?: string | null): string {
  /**
   * **닉네임이 있으면 그것이 이름이다** (S15P21A405-645·654). 예전에는 백엔드가 닉네임을 안 줘서
   * 이메일 앞부분을 이름인 척 썼다 — `hong.gildong@…` 이 `hong.gildong` 으로 보이는 식이라
   * 사람 이름도 아니고 남에게 이메일 일부를 흘리는 것이기도 했다.
   *
   * 이메일 앞부분은 **닉네임이 없을 때의 대비책**으로만 남긴다. 탈퇴 등으로 user 행이 사라지면
   * 백엔드가 닉네임에 null 을 주는데, 그때 빈칸을 두면 누구 작품인지 아예 안 보인다.
   */
  const name = nickname?.trim();
  if (name) return name;
  if (!email) return "익명";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

/** 내 작품 중 채점을 기다리는 것이 있나 — 있으면 `/mine` 을 폴링한다 */
export function awaitingScore(mine: readonly ContestEntry[] | undefined): boolean {
  return !!mine?.some((e) => e.status === "PENDING");
}

/** 내 작품은 회차당 하나다 (재출품은 교체). 목록에서 그 하나를 꺼낸다 */
export function myEntry(mine: readonly ContestEntry[] | undefined): ContestEntry | null {
  return mine?.[0] ?? null;
}

/** 뒤로 가는 곳 — **그리기 단계 안에서만** (S15P21A405-702). 첫 단계와 채점은 돌아갈 곳이 없다 */
export function backStep(step: SketchStep): SketchStep | null {
  return step === "review" ? "draw" : step === "submit" ? "review" : null;
}

/**
 * 실제로 보여 줄 단계 (S15P21A405-702). 저장된 단계가 지금 상태와 안 맞으면 그리기로 돌린다 —
 * 곡 확인·이름 단계인데 찾은 곡이 없거나(점을 고쳐 버려졌다), 채점 단계인데 낸 작품이 없을 때(지워졌다·로그아웃).
 */
export function visibleStep(step: SketchStep, state: { hasMine: boolean; hasMatch: boolean; mineScored?: boolean }): SketchStep {
  // 채점과 완성은 내 작품 상태가 가른다 — 채점이 끝나면 완성으로 저절로 넘어간다
  if (step === "scoring" || step === "done") {
    if (!state.hasMine) return "draw";
    return state.mineScored ? "done" : "scoring";
  }
  if ((step === "review" || step === "submit") && !state.hasMatch) return "draw";
  return step;
}
