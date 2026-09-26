"use client";

import type { ReactNode } from "react";

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: number;
  /** 못 누르는 상태. 흐려지고 호버도 죽는다 — 이유는 `title` 로 말한다 */
  disabled?: boolean;
  /** 툴팁 문구. 없으면 `label` */
  title?: string;
  /** 튜토리얼이 이 버튼을 밝힐 때 찾는 이름 (S15P21A405-347) */
  "data-tutorial"?: string;
  /**
   * 알약 없이 **흰 아이콘만** 떠 있는 모양 (S15P21A405-703). 폰 윗줄(`map-actions`)이 쓴다 —
   * 로고(26)와 크기를 맞춘 32px 칸에 24px 아이콘이고, 켜지면 그라데이션 원 대신 청록으로 물든다.
   * 하단 탭바와 같은 문법이다.
   */
  bare?: boolean;
}

/**
 * .railBtn — 우상단 알약 안의 아이콘 버튼. 활성 시 그라데이션 원.
 * 40px 는 알약(44px)에 맞춘 값이다 (S15P21A405-440). 글자는 없고 이름은 툴팁·aria-label 로만 (S15P21A405-434).
 */
export default function RailButton({ label, active, onClick, children, badge, disabled = false, title, "data-tutorial": dataTutorial, bare = false }: RailButtonProps) {
  const look = bare
    ? `h-8 w-8 drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)] [&_svg]:size-6 ${active ? "text-teal" : "text-ink"}`
    : `h-10 w-10 ${active ? "grad-bg text-void shadow-glow-azure" : disabled ? "text-ink-3" : "text-ink-3 hover:bg-white/[.07] hover:text-ink"}`;
  return (
    <button
      type="button"
      title={title ?? label}
      data-tutorial={dataTutorial}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative grid place-items-center rounded-pill transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${look}`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className={`num absolute top-0.5 right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-pill px-1 text-[12px] font-semibold ${
            active ? "bg-void text-teal" : "bg-teal text-[#04211d] shadow-[0_0_0_2px_#05080f]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
