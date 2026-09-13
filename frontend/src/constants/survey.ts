/**
 * 설문 문항·상수 (S15P21A405-294).
 *
 * **문항을 바꾸려면 이 파일만 고친다.** 다만 `reason` 값은 백엔드
 * `explore_feedback.reason` 의 CHECK 제약과 같아야 한다 — 없는 값을 보내면 DB 가 거부한다.
 *
 * 정본: `docs/api-spec.md` 5.1 · `docs/notion/product/01_EXPLORE_SURVEY.md`
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
import type { SurveyDefinition } from "@/types/survey";

/** 이만큼 들은 뒤에야 묻는다. 못 채우고 떠난 곡은 묻지 않고 무응답 행만 보낸다 */
export const SURVEY_MIN_LISTEN_MS = 20_000;

/** 개발용 — 이 쿼리가 붙으면 청취 시간과 무관하게 즉시 띄운다 (`?survey=force`) */
export const SURVEY_FORCE_PARAM = "survey";

/** 위 강제 플래그를 탭 세션에 남겨두는 자리 */
export const SURVEY_FORCE_KEY = "ody:survey-force";

/** 익명 사용자 식별자를 담는 자리. 정본이 이 키를 지정한다 */
export const SURVEY_ANON_KEY = "ody_anon_id";

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
