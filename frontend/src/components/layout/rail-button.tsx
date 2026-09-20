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
}

/**
 * .railBtn — 우상단 알약 안의 아이콘 버튼. 활성 시 그라데이션 원.
 * 40px 는 알약(44px)에 맞춘 값이다 (S15P21A405-440). 글자는 없고 이름은 툴팁·aria-label 로만 (S15P21A405-434).
 */
export default function RailButton({ label, active, onClick, children, badge, disabled = false, title, "data-tutorial": dataTutorial }: RailButtonProps) {
  return (
    <button
      type="button"
      title={title ?? label}
      data-tutorial={dataTutorial}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative grid h-10 w-10 place-items-center rounded-pill transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-40 max-tablet:flex max-tablet:h-tabbar max-tablet:w-auto max-tablet:flex-1 max-tablet:flex-col max-tablet:justify-center max-tablet:gap-0.5 max-tablet:rounded-none ${
        active
          ? /*
             * 폰에서는 **칠하지 않고 물들인다** (S15P21A405-417). 칸이 화면 폭의 1/5 이라
             * 그라데이션을 채우면 알약이 아니라 색 블록 하나가 되고, 밑의 글자까지 덮는다.
             * 아이콘·글자 색만 바꾸는 편이 탭바 문법에 맞는다.
             */
            "grad-bg text-void shadow-glow-azure max-tablet:bg-none max-tablet:text-teal max-tablet:shadow-none"
          : disabled
            ? "text-ink-3"
            : "text-ink-3 hover:bg-white/[.07] hover:text-ink"
      }`}
    >
      {children}
      {/* 폰에서만 아이콘 밑에 이름이 붙는다 — 데스크톱은 지금처럼 툴팁·aria 로만 (S15P21A405-434) */}
      <span className="hidden text-2xs leading-none max-tablet:block">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className={`num absolute top-0.5 right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-pill px-1 text-[9px] font-semibold ${
            active ? "bg-void text-teal" : "bg-teal text-[#04211d] shadow-[0_0_0_2px_#05080f]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
