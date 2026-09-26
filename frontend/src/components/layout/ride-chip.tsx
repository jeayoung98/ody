import type { ReactNode } from "react";

/**
 * 폰의 따라가기 한 줄 — 레이어 설명 바로 아래 (S15P21A405-703 · 705).
 *
 *   ( ● 🚀 3명이 따라오는 중 )  [모두 내리기]      ← 내가 태울 때 (`lead-chip`)
 *   ( ● 🚀 준서의 우주선 탑승 중 )  [하차]         ← 내가 탈 때 (`ride-bar`)
 *
 * **두 쪽이 같은 알약이다** (S15P21A405-705, 사용자 결정). 예전에는 타는 쪽이 윗줄을 통째로 쓰며
 * 검색·주변 탐색·여정을 감췄는데, 태우는 쪽의 작은 알약이 더 낫다는 판단으로 모양을 하나로 모았다.
 * 윗줄은 이제 그대로 보이고, 따라가는 동안에는 잠긴 채 흐리게 남는다.
 *
 * **버튼은 알약 밖 오른쪽이다** (사용자 결정). 알약은 상태를 말하고 버튼은 할 일을 말한다 —
 * 안에 넣으면 버튼 높이만큼 알약이 커지고, 무엇이 눌리는 것인지 한눈에 갈리지 않는다.
 * ⓘ 설명은 뺐다. 모두 내리기는 누르면 확인을 한 번 받으므로 미리 적어 둘 말이 없다.
 */
export default function RideChip({ dot, children, action }: { dot: "teal" | "violet"; children: ReactNode; action: ReactNode }) {
  return (
    <div className="pointer-events-auto hidden w-fit max-w-[calc(100dvw-2*var(--spacing-gutter-sm))] items-center gap-1.5 max-tablet:flex">
      <div className="glass-liquid flex min-w-0 items-center gap-2 rounded-pill! py-[5px] px-3 [--glass-tint:rgb(6_9_17/0.45)]">
        <span
          className={`animate-pulse-dot h-1.5 w-1.5 shrink-0 rounded-pill ${dot === "teal" ? "bg-teal shadow-[0_0_10px_#4fe3ce]" : "bg-violet shadow-[0_0_10px_#a67cff]"}`}
        />
        <span className="min-w-0 truncate text-[13.5px] leading-6">{children}</span>
      </div>
      {action}
    </div>
  );
}

/**
 * 알약 옆 버튼 — 되돌릴 수 없는 일(하차·모두 내리기)이라 붉은 결을 쓴다. 높이는 알약(34px)에 맞춘다.
 *
 * **알약과 같은 유리를 입힌다** (S15P21A405-705, 사용자 결정). 옅은 붉은 판만 있으면 별밭 위에서
 * 버튼이 비쳐 흐릿했다 — 뒤를 흐리게 깔고 틴트만 붉게 둬서, 옆 알약과 한 줄로 읽히면서도 눌리는 것이
 * 따로 보이게 했다.
 */
export const RIDE_CHIP_ACTION =
  "glass-liquid h-[34px] shrink-0 rounded-pill! border-bad/35! px-3 text-[12.5px] whitespace-nowrap text-[#ffb3bd] [--glass-tint:rgb(72_14_28/0.6)] hover:[--glass-tint:rgb(96_18_36/0.7)] disabled:opacity-50";
