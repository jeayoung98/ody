interface ProgressBarProps {
  /** 0~100 */
  percent: number;
  label?: string;
  /** 우측 표시 값. 없으면 percent% */
  valueText?: string;
  /** 라벨 옆 작은 모노 코드 (PC1 등) */
  code?: string;
}

/** .feat .fr — 라벨 / 그라데이션 바 / 모노 값 */
export default function ProgressBar({ percent, label, valueText, code }: ProgressBarProps) {
  const p = Math.min(100, Math.max(3, percent));
  return (
    <div className="grid grid-cols-[1fr_76px_34px] items-center gap-[9px]">
      <span className="truncate text-xs text-ink-2">
        {label}
        {code && <span className="ml-1 font-mono text-[12px] text-ink-4">{code}</span>}
      </span>
      <span className="h-1 overflow-hidden rounded-pill bg-white/[.08]">
        <i className="grad-bg block h-full rounded-pill" style={{ width: `${p}%` }} />
      </span>
      <span className="num text-right text-[12.5px] text-ink-3">{valueText ?? `${Math.round(percent)}%`}</span>
    </div>
  );
}
