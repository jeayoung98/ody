import { containsSong, type Exploration, type ListeningFlow } from "./listening-flow";
import type { SurveyEdge } from "@/types/survey";

/**
 * **설문이 왜 안 뜨는지**를 곡마다 콘솔에 남긴다 (S15P21A405-368 · 375, 개발 빌드 한정).
 *
 * 설문이 뜨기까지 넘어야 할 문이 여럿이다 — 재생 보고가 실제 청취로 인정되는가, 그때의 탐색
 * 스냅샷이 잡혔는가, 간선 규칙을 통과하는가, 이미 답한 문항이 아닌가. 판정하는 함수들은
 * `null` 만 돌려주고 이유를 말하지 않으므로, **판정에 들어간 입력을 그대로 찍는다.** 규칙을
 * 고치지 않고도 어느 문에서 막혔는지 짚을 수 있다.
 *
 * S15P21A405-369 가 재생 회로를 옮길 때 호출부가 사라져 한동안 죽은 코드였다. 그 사이
 * "주변 탐색을 켜고 이웃을 틀었는데 설문이 안 뜬다" 를 코드만 보고 추정하다 몇 번 틀렸다.
 *
 * 설문과 함께 지워진다 (`src/hooks/survey/` 폴더째). 바깥에 남는 자리가 없다.
 */

/** 실제 청취로 세기 전에 되돌아간 경우. 조용한 이유를 남긴다 */
export function logSurveySkip(musicId: number, reason: string) {
  if (process.env.NODE_ENV === "production") return;
  console.info(`%c[ODY 설문 ⏭ 건너뜀]%c musicId ${musicId} — ${reason}`, "color:#93a4c4;font-weight:600", "color:inherit");
}

/** 청취로 센 뒤 간선이 잡혔는지. 이 한 줄이 "왜 안 뜨나" 의 답이다 */
export function logSurveyHear(input: {
  musicId: number;
  exploration: Exploration | null;
  pending: SurveyEdge | null;
  flow: ListeningFlow | null;
  answered: (edge: SurveyEdge) => boolean;
}) {
  if (process.env.NODE_ENV === "production") return;
  const { musicId, exploration, pending, flow } = input;

  /** 맨 앞에서 막히는 것부터 차례로 — 첫 번째로 걸리는 것이 진짜 이유다 */
  const blocker = !exploration
    ? "탐색 스냅샷이 없다 — 주변·여정 맥락이 아니거나, 추천 결과 확인이 실패·10초 초과했다"
    : !containsSong(exploration, musicId)
      ? `이 곡이 그 탐색 목록에 없다 (${exploration.mode})`
      : flow?.unplayable.has(musicId)
        ? "이 곡이 재생 불가다 — 들려주지 못한 곡은 묻지 않는다"
        : pending == null
          ? exploration.mode === "nearby"
            ? "간선 없음 — 기준곡이 재생 불가이거나, 이 곡이 이웃 목록 밖이다 (기준곡 청취는 이제 안 따진다)"
            : "간선 없음 — 직전에 소리가 난 곡이 있어야 한다 (첫 정거장이거나, 못 튼 곡만 지나왔거나)"
          : null;

  const head = blocker ?? `${pending!.compare.title} → ${pending!.subject.title} (rank ${pending!.target.rank}) · 이 곡을 떠나는 순간 뜬다`;
  const badge = blocker ? "🚫 안 뜸" : "📝 뜰 예정";
  const tone = blocker ? "color:#93a4c4" : "color:#4fe3ce";
  const where = exploration ? (exploration.mode === "nearby" ? `주변 탐색(기준 ${exploration.center.musicId})` : "여정") : "맥락 없음";

  console.groupCollapsed(`%c[ODY 설문 ${badge}]%c musicId ${musicId} · ${where} — ${head}`, `${tone};font-weight:600`, "color:inherit");
  console.log("탐색", exploration ? { mode: exploration.mode, key: exploration.key } : null);
  console.log("자취", flow ? { 들은곡: [...flow.played], 직전곡: flow.lastPlayed, 못튼곡: [...flow.unplayable] } : null);
  console.log("물을 간선", pending?.target ?? null);
  console.groupEnd();
}
