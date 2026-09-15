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
 * 각 칸이 하는 일:
 * - `spotlight` — 밝히고 **나머지는 막을** 자리 (S15P21A405-347)
 * - `ringOnly` — 고리만 두르고 **막지는 않을** 자리. 이게 찾아지면 이쪽이 이긴다
 * - `hint` — 밝힌 자리 한가운데에 띄울 그림
 * - `card` — 안내 카드를 위에 둘지 아래에 둘지. 우측 패널을 봐야 하는 단계는 아래다
 * - `lock` — 지도 조작(휠·이동)까지 막을지
 * - `free` — 어둠막을 아예 덮지 않고, 아무 데나 누르면 넘어가는 단계인지
 *
 * `spotlight`·`ringOnly` 는 앞에서부터 먼저 찾아지는 것을 쓴다. `"map"` 은 지도가 실제로
 * 보이는 사각형, `"star"` 는 이 단계에서 짚어 준 별 하나다 (`tutorial-spotlight.tsx`).
 */
export const TUTORIAL_STEPS = [
  {
    key: "zoom",
    title: "확대해보세요",
    description: "휠을 굴려 별지도를 확대해보세요. 확대할수록 별이 더 드러나고, 화면 안 곡이 충분히 줄면 벽에 닿아요. 계속 밀면 다음 겹으로 파고들어요.",
    task: "zoom",
    /**
     * **덮지 않는다** (S15P21A405-350). 휠을 굴리라는 안내뿐이라 막을 것이 없고, 처음 보는
     * 화면이 까맣게 덮여 있으면 별지도가 어떤 곳인지 자체가 안 보인다. `ringOnly` 에 두면
     * 어둠막 없이 자리만 잡는다 — 지도는 화면만 해서 고리도 두르지 않는다.
     */
    spotlight: [],
    ringOnly: ["map"],
    hint: "zoom",
    card: "top",
    lock: false,
    free: false,
  },
  {
    key: "click",
    title: "이 별을 눌러보세요",
    description: "밝게 짚어 둔 별을 눌러보세요. 곡 상세가 열리고 화면이 그 별로 옮겨져요. 재생을 눌러야 내 위치가 따라갑니다.",
    task: "select",
    // 짚어 준 별 하나만 열어 둔다. 어느 별이든 되는 단계가 아니라 지도 조작도 막는다
    spotlight: ["star"],
    ringOnly: [],
    hint: "star",
    card: "top",
    lock: true,
    free: false,
  },
  {
    key: "nearby",
    title: "주변을 탐색해보세요",
    description: "곡 상세에서 주변 탐색을 켜면 소리가 가장 닮은 10곡이 고리로 펼쳐져요. 실제로 닮게 들리는지가 이번 테스트의 질문입니다.",
    task: "nearby",
    spotlight: ["nearby"],
    ringOnly: [],
    hint: "none",
    card: "top",
    lock: false,
    free: false,
  },
  {
    key: "look",
    title: "이렇게 펼쳐져요",
    description: "가운데가 기준 곡, 둘레가 소리로 가장 가까운 10곡이에요. 하나씩 눌러 들어보세요. 다 보셨으면 아무 곳이나 누르세요.",
    // 화면을 보여 주는 단계다. 덮지 않고, 아무 데나 누르면 넘어간다
    task: "look",
    spotlight: [],
    ringOnly: [],
    hint: "none",
    card: "top",
    lock: false,
    free: true,
  },
  {
    key: "journey-start",
    title: "여정, 출발곡부터",
    description: "오른쪽 여정 탭을 열고 여정 만들기를 누른 다음, 위 칸에 출발곡을 고르세요. 상자에서 검색하거나 지도에서 별을 눌러도 돼요.",
    task: "journey-start",
    spotlight: ["journey"],
    /**
     * 여정 패널·만들기 상자가 열린 뒤로는 **어둠막을 걷는다.** 출발곡·도착곡을 지도에서 눌러
     * 고르는 단계라 지도를 막아 버리면 이 단계를 끝낼 수가 없다. 고리만 그 자리로 옮긴다.
     */
    ringOnly: ["journey-composer", "panel-journey"],
    hint: "none",
    card: "bottom",
    lock: false,
    free: false,
  },
  {
    key: "journey-end",
    title: "이제 도착곡",
    description: "아래 칸에 도착곡을 고르세요. 여기서 저기까지 소리가 어떻게 이어지는지를 보는 겁니다.",
    task: "journey-end",
    spotlight: ["journey-composer", "panel-journey", "journey"],
    ringOnly: ["journey-composer", "panel-journey"],
    hint: "none",
    card: "bottom",
    lock: false,
    free: false,
  },
  {
    key: "journey-create",
    title: "여정 만들기를 누르세요",
    description: "두 곡을 골랐다고 경로가 생기지는 않아요. 여정 만들기를 눌러야 두 곡 사이를 이어 주는 곡들이 지도에 그려집니다.",
    task: "journey",
    spotlight: ["journey-composer", "panel-journey", "journey"],
    ringOnly: ["journey-composer", "panel-journey"],
    hint: "none",
    card: "bottom",
    lock: false,
    free: false,
  },
] as const;
export type TutorialTask = (typeof TUTORIAL_STEPS)[number]["task"];
