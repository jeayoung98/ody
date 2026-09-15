/**
 * 튜토리얼 단계. 각 단계는 사용자에게 작은 태스크를 주고 완료되면 다음으로 넘어간다.
 *
 * **이번 유저 테스트에서 설문을 받는 두 기능을 반드시 거치게 한다** (S15P21A405-343) —
 * 주변 탐색과 여정. 한 번도 안 써 본 사람이 "비슷하게 들리나요" 설문을 만나면 답할 수가 없다.
 * 그래서 탐색(확대·별 누르기) → 주변 탐색 → 여정 순이다.
 *
 * 여정은 **세 단계로 쪼갠다** (S15P21A405-349). 예전에는 출발곡 하나만 고르면 넘어가 버려서,
 * 정작 경로가 생기는 지점인 "여정 만들기" 를 안 배운 채 끝났다.
 *
 * **어느 칸도 조작을 막지 않는다** (S15P21A405-354). 튜토리얼은 가리켜 주기만 하고, 그 사이에도
 * 지도를 둘러보거나 다른 것을 눌러 볼 수 있다.
 *
 * 각 칸이 하는 일:
 * - `spotlight` — 연한 덤을 덮고 **이 자리만 구멍을 내어** 고리를 두른다. 앞에서부터
 *   먼저 찾아지는 것을 쓰므로, 한 단계 안에서 자리가 옮겨 다니면 나중에 열리는 것을 앞에 적는다
 * - `hint` — 덮은 위에 따로 그릴 손짓 (`wheel` 마우스 · `star` 짚은 별)
 * - `card` — 안내 카드 자리. 우측 패널을 보는 단계는 `left`·`bottom` 으로 비켜 준다
 * - `cta` — 누를 곳이 따로 없어 **카드의 버튼으로 넘기는** 단계의 버튼 글. 비면 버튼이 없다
 * - `veil` — 연한 덤을 덮을지. 화면 자체를 보여 주는 단계는 덮지 않는다
 *
 * `"map"` 만 DOM 요소가 아니라 지도가 실제로 보이는 사각형이다 (`tutorial-spotlight.tsx`).
 */
export const TUTORIAL_STEPS = [
  {
    key: "zoom",
    title: "확대해보세요",
    description: "휠을 굴려 별지도를 확대해보세요. 확대할수록 별이 더 드러나고, 화면 안 곡이 충분히 줄면 벽에 닿아요. 계속 밀면 다음 겹으로 파고들어요.",
    task: "zoom",
    // 짚을 자리가 없다 — 통째로 연하게 덮고 그 위에 휠 손짓만 올린다. 처음 굴리면 손짓은 사라진다
    spotlight: [],
    hint: "wheel",
    card: "top",
    cta: "",
    veil: true,
  },
  {
    key: "click",
    title: "이 별을 눌러보세요",
    description: "밝게 짚어 둔 별을 눌러보세요. 곡 상세가 열리고 화면이 그 별로 옮겨져요. 재생을 눌러야 내 위치가 따라갑니다.",
    task: "select",
    /**
     * 구멍을 뚫지 않는다. 짚은 별은 `hint` 가 **오버레이 위에 직접 그리고** 클릭도 거기서
     * 받는다 — 캔버스 별에 기대면 안 보이거나 아예 없다. 통째로 덮되 **막지는 않는다**
     * (S15P21A405-354): 짚어 준 별 말고 다른 별을 눌러 봐도 되고, 확대·이동도 된다.
     */
    spotlight: [],
    hint: "star",
    card: "top",
    cta: "",
    veil: true,
  },
  {
    key: "nearby",
    title: "주변을 탐색해보세요",
    description: "곡 상세에서 주변 탐색을 켜면 소리가 가장 닮은 10곡이 고리로 펼쳐져요. 실제로 닮게 들리는지가 이번 테스트의 질문입니다.",
    task: "nearby",
    spotlight: ["nearby"],
    hint: "none",
    // 우측 곡 상세가 처음 뜨는 자리다 — 카드가 가운데 있으면 그걸 가린다
    card: "left",
    cta: "",
    veil: true,
  },
  {
    key: "look",
    title: "이렇게 펼쳐져요",
    description: "가운데가 기준 곡, 둘레가 소리로 가장 가까운 10곡이에요. 하나씩 눌러 들어보세요. 다 들어봤으면 오른쪽 여정 버튼을 누르세요.",
    /**
     * 들어 보는 단계다. 아무 데나 누르면 넘어가게 두면 한 곡도 못 들어 본 채 끝나므로,
     * **여정으로 넘어가겠다고 직접 누를 때** 넘어간다 (S15P21A405-354).
     */
    task: "look",
    spotlight: ["journey"],
    hint: "none",
    // 지도 한가운데 펼쳐진 고리를 봐야 하는 단계다 — 카드는 우측 패널 위로 비켜 준다
    card: "right",
    cta: "",
    veil: true,
  },
  {
    key: "journey-start",
    title: "여정, 출발곡부터",
    description: "오른쪽 여정 탭을 열고 여정 만들기를 누른 다음, 위 칸에 출발곡을 고르세요. 상자에서 검색하거나 지도에서 별을 눌러도 돼요.",
    task: "journey-start",
    // 만들기 상자가 열리면 고리가 그리로 옮겨 간다 — 먼저 찾아지는 것이 이긴다
    spotlight: ["journey-composer", "panel-journey", "journey"],
    hint: "none",
    card: "bottom",
    cta: "",
    veil: true,
  },
  {
    key: "journey-end",
    title: "이제 도착곡",
    description: "아래 칸에 도착곡을 고르세요. 여기서 저기까지 소리가 어떻게 이어지는지를 보는 겁니다.",
    task: "journey-end",
    spotlight: ["journey-composer", "panel-journey", "journey"],
    hint: "none",
    card: "bottom",
    cta: "",
    veil: true,
  },
  {
    key: "journey-create",
    title: "여정 만들기를 누르세요",
    description: "두 곡을 골랐다고 경로가 생기지는 않아요. 여정 만들기를 눌러야 두 곡 사이를 이어 주는 곡들이 지도에 그려집니다.",
    task: "journey",
    // 상자 전체를 두르면 정작 눌러야 할 버튼이 안 짚힌다 (S15P21A405-353)
    spotlight: ["journey-create", "journey-composer", "panel-journey", "journey"],
    hint: "none",
    card: "bottom",
    cta: "",
    veil: true,
  },
  {
    key: "journey-look",
    title: "여정이 그려졌어요",
    description: "두 곡을 잇는 별들이 순서대로 놓였어요. 눌러서 들어보면 소리가 조금씩 옮겨 갑니다 — 그 흐름이 자연스러운지가 설문에서 물어볼 내용이에요.",
    /**
     * 만들고 끝내지 않고 **결과를 보고** 끝낸다 (S15P21A405-354). 경로가 어떻게 생겼는지
     * 한 번은 봐야 "자연스럽게 이어지나요" 설문에 답할 수 있다. 누를 곳이 따로 없는
     * 단계라 안내 카드의 버튼으로 끝낸다.
     */
    task: "done",
    spotlight: [],
    hint: "none",
    card: "bottom",
    cta: "다 봤어요",
    // 만든 여정을 보는 단계다. 덮으면 그걸 흐리게 만든다
    veil: false,
  },
] as const;
export type TutorialTask = (typeof TUTORIAL_STEPS)[number]["task"];
