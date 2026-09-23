import { CONTEST_SORTS } from "@/constants";
import type { ContestSort } from "@/types";

interface SortSelectProps {
  value: ContestSort;
  onChange: (sort: ContestSort) => void;
}

/** 갤러리 정렬 — 종류가 다섯이라 탭 대신 셀렉트다. 정렬은 서버가 한다 */
export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <select
      id="contest-sort"
      aria-label="정렬"
      value={value}
      onChange={(e) => onChange(e.target.value as ContestSort)}
      className="h-8 rounded-box-xs border border-line bg-void-2 px-2 text-xs text-ink focus:border-line-2 focus:outline-none"
    >
      {CONTEST_SORTS.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
