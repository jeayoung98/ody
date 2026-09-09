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
