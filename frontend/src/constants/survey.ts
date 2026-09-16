/**
 * 설문 문항·상수 (S15P21A405-294 · 335).
 *
 * **문항을 바꾸려면 이 파일만 고친다.** 다만 `reason` 값은 백엔드
 * `explore_feedback.reason` 의 CHECK 제약과 같아야 한다 — 없는 값을 보내면 DB 가 거부한다.
 *
 * 정본: `docs/api-spec.md` 5.1 · `docs/notion/product/01_EXPLORE_SURVEY.md`
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
import type { SurveyDefinition } from "@/types/survey";

/**
 * **청취 시간 조건은 없다** (S15P21A405-335 · 346).
 *
 * 예전에는 두 곡을 각각 20초 이상 들었을 때만 물었다(`SURVEY_MIN_LISTEN_MS`). 그 조건이
 * 표본을 너무 줄였고 짧게 훑는 탐색에서는 아무것도 안 남았다. 지금은 **알고리즘이 제안한
 * 간선을 밟았으면** 묻는다 — 얼마나 들었는지는 `listened_sec` 값으로만 남고 판정에 안 쓴다.
 * 조건이 사라지면서 `?survey=force` 도 할 일이 없어져 함께 걷어냈다.
 */

/** 익명 사용자 식별자를 담는 자리. 정본이 이 키를 지정한다 */
export const SURVEY_ANON_KEY = "ody_anon_id";
export const SURVEY_API = { feedback: "/bff/feedback", answered: "/bff/feedback/answered" } as const;
export const SURVEY_QUERY_KEYS = { answered: ["survey", "answered"] as const };

/**
 * 평가 대상 곡에 붙는 말. **모드가 달라도 같다** — 비교 상대(`compareLabel`)는 기준곡이냐
 * 앞 역이냐로 갈리지만, 평가 대상은 양쪽 다 "방금 들은 그 곡" 하나로 같은 것을 가리킨다.
 */
export const SURVEY_TARGET_LABEL = "방금 들은 곡";

/**
 * 이유 칩 — **백엔드 결함 코드와 1:1** 이다. 각각 고칠 곳이 다르다.
 *
 * - `dup` 같은 녹음의 다른 판 → `tau_dup` 상향
 * - `mood` 소리 자체가 다름 → `tau_far` 하향·hub 벌점. 가까운 거리에서도 많으면 좌표 문제
 * - `tempo` 분위기는 비슷한데 빠르기 차이 → bpm 차이 벌점
 * - `spoken` 말·낭독·효과음 → 정제 규칙에서 제외
 *
 * **문구는 모드마다 다르다.** 주변 탐색은 두 곡을 나란히 놓고 비교하니 `다름` 이고,
 * 여정은 흐름이 끊긴 것을 묻는 것이라 `튐` 이다. 저장되는 코드는 같아서 분석은 한 표에서 본다.
 */
const NEARBY_REASONS = [
  { value: "mood", label: "분위기 다름" },
  { value: "tempo", label: "템포 다름" },
  { value: "dup", label: "같은 곡 반복" },
  { value: "spoken", label: "음악 아님" },
] as const;

const JOURNEY_REASONS = [
  { value: "mood", label: "분위기 튐" },
  { value: "tempo", label: "템포 튐" },
  { value: "dup", label: "같은 곡 반복" },
  { value: "spoken", label: "음악 아님" },
] as const;

/**
 * 주변 탐색 — "기준곡과 비슷한가"를 묻는다.
 *
 * '마음에 드나요'가 아니라 '비슷하게 들리나요'인 이유: 취향을 물으면 개인 선호와
 * 유사도가 섞여서 거리 기반 알고리즘을 평가할 수 없다.
 */
const NEARBY: SurveyDefinition = {
  mode: "nearby",
  compareLabel: "기준곡",
  // 비교 상대를 제목으로 바로 위에 보여주므로 질문에서 다시 가리키지 않는다
  question: "비슷했나요?",
  yes: "네, 비슷해요",
  reasonQuestion: "어떤 점이 아쉬웠나요?",
  reasons: NEARBY_REASONS,
};

/** 경로 탐색 — "앞 곡에서 자연스럽게 이어졌는가"를 묻는다 */
const JOURNEY: SurveyDefinition = {
  mode: "journey",
  compareLabel: "앞 곡",
  question: "자연스럽게 이어졌나요?",
  yes: "네, 자연스러워요",
  reasonQuestion: "어떤 점이 아쉬웠나요?",
  reasons: JOURNEY_REASONS,
};

export const SURVEYS = { nearby: NEARBY, journey: JOURNEY } as const;

/**
 * 기준곡을 아직 안 들은 채 이웃을 누를 때 (S15P21A405-371).
 *
 * 주변 탐색 설문은 "기준곡과 견줘서 닮았나" 를 묻기 때문에, 기준곡 소리를 들어본 적이 없으면
 * 물을 수가 없다 (결정 1). 그런데 화면은 그 순서를 알려주지 않아서 이웃부터 눌러보게 되고,
 * 그러면 설문이 한 건도 안 뜬다. **막지 말고 기준곡을 대신 틀어 준다** — 하라는 말만 하고
 * 사용자가 알아서 찾게 두면 또 못 찾는다.
 */
export const ANCHOR_FIRST_NOTICE = "기준곡을 먼저 들려드릴게요. 듣고 나서 이웃 곡을 눌러 주세요";
