/**
 * 설문 문항·상수 (S15P21A405-250).
 *
 * **문항을 바꾸려면 이 파일만 고친다.** 단계 수가 늘어도 카드 컴포넌트는 그대로다 —
 * 단계는 `steps` 배열의 길이로 결정된다.
 *
 * 문항을 바꿨으면 `SURVEY_VERSION` 도 올린다. 안 올리면 예전 응답과 섞여
 * 버전 간 비교가 불가능해진다.
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
import type { SurveyDefinition } from "@/types/survey";

/** 문항이 바뀌면 올린다 */
export const SURVEY_VERSION = "v1";

/** 이만큼 들은 뒤에야 묻는다. 자동재생이 붙으면 실제 청취 시간으로 잰다 */
export const SURVEY_MIN_LISTEN_MS = 20_000;

/**
 * 개발용 — 청취 시간을 기다리지 않고 즉시 띄운다.
 *
 * `?survey=force` 로 켜고 `?survey=off` 로 끈다. 한 번 켜면 그 탭이 닫힐 때까지 유지된다 —
 * 화면 진입 직후 라우터가 쿼리를 지워버려서 쿼리만 보면 금방 사라지기 때문이다.
 */
export const SURVEY_FORCE_PARAM = "survey";

/** 위 강제 플래그를 탭 세션에 남겨두는 자리 */
export const SURVEY_FORCE_KEY = "ody:survey-force";

/** 판단이 안 설 때 고르는 값. 분석에서 제외한다 */
export const SURVEY_UNSURE = "unsure";

/** 이유 축 — 사용자 말로 쓴다. PCA 축과 1:1로 대응하지 않는다 */
const AXES = {
  mood: "분위기",
  tempo: "빠르기",
  timbre: "목소리·악기 소리",
} as const;

/**
 * 주변 탐색 — "기준곡과 비슷한가"를 묻는다.
 *
 * '마음에 드나요'가 아니라 '비슷하게 들리나요'인 이유: 취향을 물으면 개인 선호와
 * 유사도가 섞여서 거리 기반 알고리즘을 평가할 수 없다.
 */
const NEARBY: SurveyDefinition = {
  kind: "nearby",
  steps: [
    {
      question: "이 곡, 이전 곡과 비슷하게 들리나요?",
      multiple: false,
      options: [
        { value: "similar", label: "비슷해요" },
        { value: "different", label: "달라요" },
        { value: SURVEY_UNSURE, label: "잘 모르겠어요", terminal: true },
      ],
    },
    {
      // 긍정·부정 양쪽 다 이유를 묻는다 — 무엇이 잘 맞았는지도 개선에 쓰인다
      multiple: true,
      question: "어떤 점이 그랬나요?",
      questionByPrev: {
        similar: "어떤 점이 비슷했나요?",
        different: "어떤 점이 달랐나요?",
      },
      optionsByPrev: {
        similar: [
          { value: "mood", label: AXES.mood },
          { value: "tempo", label: AXES.tempo },
          { value: "timbre", label: AXES.timbre },
          // 같은 곡의 다른 버전(라이브·리마스터)이 이웃으로 뜨는 건 중복 판정 실패다
          { value: "same_song", label: "같은 곡 같아요" },
        ],
        different: [
          { value: "mood", label: AXES.mood },
          { value: "tempo", label: AXES.tempo },
          { value: "timbre", label: AXES.timbre },
        ],
      },
    },
  ],
};

/**
 * 경로 탐색 — "앞 곡에서 자연스럽게 이어지는가"를 묻는다.
 *
 * 경로 전체가 아니라 **방금 들은 전환 한 곳**만 평가하게 한다. 전체를 묻으면
 * 다 듣지 않은 사용자가 답할 수 없고, 고칠 위치도 특정되지 않는다.
 */
const TRANSITION: SurveyDefinition = {
  kind: "transition",
  steps: [
    {
      question: "앞 곡에서 이 곡으로 자연스럽게 이어졌나요?",
      multiple: false,
      options: [
        { value: "smooth", label: "자연스러워요" },
        { value: "abrupt", label: "어색해요" },
        { value: SURVEY_UNSURE, label: "잘 모르겠어요", terminal: true },
      ],
    },
    {
      multiple: true,
      question: "어떤 점이 그랬나요?",
      questionByPrev: {
        smooth: "어떤 점이 좋았나요?",
        abrupt: "어떤 점이 어색했나요?",
      },
      optionsByPrev: {
        smooth: [
          { value: "mood_flow", label: "분위기가 이어짐" },
          { value: "tempo_flow", label: "빠르기가 이어짐" },
          { value: "timbre_flow", label: "목소리·악기 소리가 이어짐" },
        ],
        abrupt: [
          { value: "mood_jump", label: "분위기가 갑자기 바뀜" },
          { value: "tempo_jump", label: "빠르기가 갑자기 바뀜" },
          // 같은 녹음이 반복되는 건 중복 판정이나 다양성 규칙 쪽 문제다
          { value: "too_similar", label: "너무 비슷해서 반복 같음" },
        ],
      },
    },
  ],
};

export const SURVEYS = { nearby: NEARBY, transition: TRANSITION } as const;
