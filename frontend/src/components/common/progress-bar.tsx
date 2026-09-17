interface ProgressBarProps {
  /** 0~100 */
  percent: number;
  label?: string;
  /** 우측 표시 값. 없으면 percent% */
  valueText?: string;
  /** 라벨 옆 작은 모노 코드 (PC1 등) */
  code?: string;
  /**
   * 한 단계 작은 글씨. 곡 상세의 고정 주성분 목록이 쓴다 (S15P21A405-384) — 같은 칸의
   * 차트 라벨(9.5px)과 눈높이를 맞춰야 한 덩어리로 읽힌다.
   */
  dense?: boolean;
}

/** .feat .fr — 라벨 / 그라데이션 바 / 모노 값 */
export default function ProgressBar({ percent, label, valueText, code, dense = false }: ProgressBarProps) {
  const p = Math.min(100, Math.max(3, percent));
  return (
    <div className="grid grid-cols-[1fr_76px_34px] items-center gap-[9px]">
      <span className={`truncate text-ink-2 ${dense ? "text-[9.5px]" : "text-xs"}`}>
        {label}
        {code && <span className={`ml-1 font-mono text-ink-4 ${dense ? "text-[8.5px]" : "text-[9px]"}`}>{code}</span>}
      </span>
      <span className="h-1 overflow-hidden rounded-pill bg-white/[.08]">
        <i className="grad-bg block h-full rounded-pill" style={{ width: `${p}%` }} />
      </span>
      <span className={`num text-right text-ink-3 ${dense ? "text-[9px]" : "text-[10px]"}`}>{valueText ?? `${Math.round(percent)}%`}</span>
    </div>
  );
}
