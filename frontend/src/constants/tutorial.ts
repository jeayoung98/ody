/**
 * 튜토리얼 단계. 각 단계는 사용자에게 작은 태스크를 주고 완료되면 다음으로 넘어간다.
 *
 * **이번 유저 테스트에서 설문을 받는 두 기능을 반드시 거치게 한다** (S15P21A405-343) —
 * 주변 탐색과 여정. 한 번도 안 써 본 사람이 "비슷하게 들리나요" 설문을 만나면 답할 수가 없다.
 * 그래서 탐색(확대·별 누르기) → 주변 탐색 → 여정 → 시작점 순이다.
 */
export const TUTORIAL_STEPS = [
  {
    key: "zoom",
    title: "확대해보세요",
    description: "휠을 굴려 별지도를 확대해보세요. 확대할수록 별이 더 드러나고, 화면 안 곡이 충분히 줄면 벽에 닿아요. 계속 밀면 다음 겹으로 파고들어요.",
    task: "zoom",
  },
  {
    key: "click",
    title: "별을 클릭해보세요",
    description: "마음에 드는 별(곡)을 하나 클릭해보세요. 곡 상세가 열리고 화면이 그 별로 옮겨져요. 재생을 눌러야 내 위치가 따라갑니다.",
    task: "select",
  },
  {
    key: "nearby",
    title: "주변을 탐색해보세요",
    description: "곡 상세에서 주변 탐색을 켜면 소리가 가장 닮은 10곡이 고리로 펼쳐져요. 하나씩 눌러 들어보세요 — 실제로 닮게 들리는지가 이번 테스트의 질문입니다.",
    task: "nearby",
  },
  {
    key: "journey",
    title: "여정을 만들어보세요",
    description: "오른쪽 여정 탭에서 출발곡과 도착곡을 고르고 경로를 만들어보세요. 두 곡 사이를 소리가 조금씩 바뀌며 이어줍니다 — 그 흐름이 자연스러운지도 물어볼 거예요.",
    task: "journey",
  },
  {
    key: "start",
    title: "시작점을 정하세요",
    description: "이 곡에서 탐험을 시작할까요?",
    task: "confirm",
  },
] as const;
export type TutorialTask = (typeof TUTORIAL_STEPS)[number]["task"];
