"use client";

import type { ReactNode } from "react";

interface TransportButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /**
   * 못 쓰는 것처럼 **보이되 눌리기는 한다** (S15P21A405-336).
   *
   * 다시 눌러 볼 여지가 있을 때만 쓴다. 눌러도 답이 같은 것(찾아봤는데 음원이 없는 곡)은
   * `dimmed` 가 아니라 `disabled` 다 — 호버까지 죽어야 "여기는 끝" 으로 읽힌다.
   *
   * 눌렀는데 아무 일도 안 나는 게 제일 나쁘다 — 누르면 왜 안 되는지 토스트로 알려 줄 수 있게
   * 클릭은 살려 둔다. 옆의 "내 위치로 가기" 버튼이 쓰는 것과 같은 수법이다.
   */
  dimmed?: boolean;
  primary?: boolean;
  /**
   * 지름. 기본 `sm`(32px), `md` 는 36px 이고 `primary` 는 항상 `md` 다.
   *
   * 곡 상세 제목 줄에서 쓴다 (S15P21A405-384) — 플리 추가와 재생이 나란히 서므로 **크기를
   * 맞추되** 색으로만 무게를 가른다. 플레이어바의 이전/다음은 `sm` 그대로다.
   */
  size?: "sm" | "md";
  /**
   * 아이콘을 제일 밝은 색으로. 기본(`ink-2`)은 플레이어바의 이전/다음처럼 **주인공 옆에서
   * 거드는 버튼** 기준이라, 곡 상세 제목 줄의 플리 추가처럼 혼자 서 있는 버튼은 흐려 보인다
   * (S15P21A405-384).
   */
  bright?: boolean;
  children: ReactNode;
}

/** .tBtn / #tPlay — 하단 플레이어바와 곡 상세 제목 줄이 함께 쓴다 */
export default function TransportButton({ label, onClick, disabled, dimmed, primary, size = "sm", bright = false, children }: TransportButtonProps) {
  const wide = primary || size === "md";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={dimmed || undefined}
      className={`grid shrink-0 place-items-center rounded-pill transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-35 ${dimmed ? "opacity-35" : ""} ${
        wide ? "h-9 w-9" : "h-8 w-8"
      } ${primary ? "bg-white/10 text-ink" : bright ? "text-ink" : "text-ink-2"} ${
        // 꺼진 버튼은 **호버도 하지 않는다** (S15P21A405-384). 색이 변하면 눌릴 것처럼 보인다
        disabled ? "" : primary ? "hover:grad-bg hover:text-void" : "hover:bg-white/[.08] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
