import type { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  /** 우측 보조 텍스트/액션 */
  aside?: ReactNode;
}

/** .sectHead + .lbl — 패널 내부 소제목 (모노 대문자 라벨) */
export default function SectionTitle({ children, aside }: SectionTitleProps) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <h3 className="lbl">{children}</h3>
      {aside && <div className="text-xs text-ink-3">{aside}</div>}
    </div>
  );
}
