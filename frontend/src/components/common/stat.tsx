import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  /** 숫자면 모노 폰트로 */
  numeric?: boolean;
}

/** .kv — 라벨 : 값 한 줄. dl 안에서 여러 개 쌓아 쓴다 */
export default function Stat({ label, value, numeric = false }: StatProps) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[.045] py-[5px] text-sm last:border-b-0">
      <dt className="shrink-0 text-xs text-ink-3">{label}</dt>
      <dd className={`m-0 min-w-0 text-right ${numeric ? "num" : ""}`}>{value}</dd>
    </div>
  );
}
