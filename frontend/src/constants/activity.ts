import { eulReul, iGa } from "@/lib/josa";

/**
 * 배타 활동 (ACT-01). 따라가기 · 여정 재생 · 플레이리스트 재생은 동시에 진행할 수 없다.
 * 단일 곡 재생은 활동이 아니다.
 */
export const ACTIVITY_KINDS = ["follow", "journey", "playlist"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  follow: "따라가기",
  journey: "여정 재생",
  playlist: "플레이리스트 재생",
};

export const ACTIVITY_CONFIRM = {
  title: (next: ActivityKind) => `${ACTIVITY_LABELS[next]}${eulReul(ACTIVITY_LABELS[next])} 시작할까요?`,
  message: (current: ActivityKind, currentDetail: string | null, next: ActivityKind) => {
    const cur = ACTIVITY_LABELS[current];
    const detail = currentDetail ? ` (${currentDetail})` : "";
    return `지금 진행 중인 ${cur}${detail}${iGa(currentDetail ?? cur)} 멈춥니다. 멈추고 ${ACTIVITY_LABELS[next]}${eulReul(ACTIVITY_LABELS[next])} 시작할까요?`;
  },
  confirm: "멈추고 시작",
  cancel: "취소",
} as const;

/**
 * 순차 재생 중에 **그 목록 밖의 곡**을 재생할 때 (S15P21A405-341).
 *
 * 단일 곡 재생은 배타 활동이 아니라서 `ACTIVITY_CONFIRM` 을 쓸 수 없다(위 정의). 그래도
 * 듣던 목록이 통째로 닫히는 일이라 **물어보지 않고 넘어가면 안 된다** — 곡 하나 눌렀을 뿐인데
 * 여정이 사라진 것으로 겪는다.
 */
export const LEAVE_LIST_CONFIRM = {
  title: "이 곡만 재생할까요?",
  message: (current: ActivityKind, currentDetail: string | null) => {
    const cur = ACTIVITY_LABELS[current];
    const detail = currentDetail ? ` (${currentDetail})` : "";
    return `목록 밖의 곡이라 지금 진행 중인 ${cur}${detail}${iGa(currentDetail ?? cur)} 멈추고 목록이 닫힙니다. 이 곡만 재생할까요?`;
  },
  confirm: "멈추고 재생",
  cancel: "취소",
} as const;
