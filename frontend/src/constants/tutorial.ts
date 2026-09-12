/** 튜토리얼 단계. 최대 5단계. 각 단계는 사용자에게 작은 태스크를 주고 완료되면 다음으로 넘어간다 */
export const TUTORIAL_STEPS = [
  { key: "zoom", title: "확대해보세요", description: "휠을 굴려 별지도를 확대해보세요. 확대할수록 별이 더 드러나고, 충분히 확대하면 벽에 닿아요. 계속 밀면 다음 레이어로 파고들어요.", task: "zoom" },
  { key: "click", title: "별을 클릭해보세요", description: "마음에 드는 별(곡)을 하나 클릭해보세요. 곡 상세가 열리고 화면이 그 별로 옮겨져요. 재생을 눌러야 내 위치가 따라갑니다.", task: "select" },
  { key: "nearby", title: "주변을 탐색해보세요", description: "가까운 곡 10곡을 살펴보세요.", task: "nearby" },
  { key: "start", title: "시작점을 정하세요", description: "이 곡에서 탐험을 시작할까요?", task: "confirm" },
] as const;
export type TutorialTask = (typeof TUTORIAL_STEPS)[number]["task"];
