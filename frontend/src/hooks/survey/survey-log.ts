import type { SurveyEdge } from "@/types/survey";
import type { Trail } from "./edge-rules";

/**
 * **설문이 왜 안 뜨는지**를 곡마다 콘솔에 남긴다 (S15P21A405-368, 개발 빌드 한정).
 *
 * 스위치를 켜도 설문은 조건이 여럿이라(튜토리얼 완료 · 여정/주변 맥락 · 간선 성립 · 중복 응답
 * 아님) **안 뜨는 것이 정상인지 고장인지 구분할 수가 없었다.** 판정은 `edge-rules` 의 순수
 * 함수가 내리는데 그 함수는 `null` 만 돌려주지 이유를 말하지 않는다. 그래서 **판정에 들어간
 * 입력을 그대로 찍는다** — 규칙을 고치지 않고도 어디서 걸렸는지 짚을 수 있다.
 *
 * 설문과 함께 지워진다 (`src/hooks/survey/` 폴더째). 바깥에 남는 자리가 없다.
 */
export function logSurveyGate(input: {
  musicId: number;
  tutorialDone: boolean;
  /** 재생 맥락 — 여정인가 */
  inJourney: boolean;
  /** 지도 뷰 기준 주변 탐색인가 */
  inNearby: boolean;
  /** 판정된 간선. null 이면 이번 곡은 묻지 않는다 */
  edge: SurveyEdge | null;
  /** 이미 답한 문항이라 건너뛰는가 */
  alreadyAnswered: boolean;
  trail: Trail;
}) {
  if (process.env.NODE_ENV === "production") return;

  const { musicId, tutorialDone, inJourney, inNearby, edge, alreadyAnswered, trail } = input;

  /** 맨 앞에서 막히는 것부터 차례로 — 첫 번째로 걸리는 것이 진짜 이유다 */
  const blocker = !tutorialDone
    ? "튜토리얼을 아직 안 끝냈다 (끝나야 설문이 붙는다)"
    : !inJourney && !inNearby
      ? "여정도 주변 탐색도 아니다 (단독·플리 재생은 묻지 않는다)"
      : alreadyAnswered
        ? "이미 답한 문항이다"
        : edge == null
          ? inJourney
            ? "간선 없음 — 직전에 소리가 난 곡이 있어야 한다 (첫 정차이거나, 못 튼 곡만 지나왔거나)"
            : "간선 없음 — 기준곡을 실제로 들어봤어야 하고, 기준곡·이 곡 둘 다 재생 가능해야 한다"
          : null;

  const badge = blocker ? "🚫 안 뜸" : "📝 뜰 예정";
  const tone = blocker ? "color:#93a4c4" : "color:#4fe3ce";
  const where = inJourney ? "여정" : inNearby ? "주변 탐색" : "해당 없음";

  console.groupCollapsed(`%c[ODY 설문 ${badge}]%c musicId ${musicId} · ${where}`, `${tone};font-weight:600`, "color:inherit");
  if (blocker) console.log("막힌 곳", blocker);
  else console.log("물을 간선", `${edge!.compare.title} → ${edge!.subject.title} (rank ${edge!.target.rank})`);
  console.log("튜토리얼 완료", tutorialDone);
  console.log("맥락", { inJourney, inNearby });
  console.log("자취", { 들은곡: trail.played.size, 직전곡: trail.lastPlayed, 못튼곡: trail.unplayable.size });
  console.log("이미 답함", alreadyAnswered);
  /** 카드가 뜨는 순간은 **곡을 떠날 때**다 — 듣고만 있으면 영영 안 뜬다 (`use-blocking-store` 의 gate) */
  if (!blocker) console.log("언제", "지금 곡을 떠나는 순간 카드가 뜬다");
  console.groupEnd();
}
