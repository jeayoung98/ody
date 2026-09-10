import ProgressBar from "@/components/common/progress-bar";
import SectionTitle from "@/components/common/section-title";

interface SongPcListProps {
  items: { label: string; value: number }[];
}

/** .feat — 고정 주성분 값. -1~1 을 바 길이로, 값은 모노 표기 */
export default function SongPcList({ items }: SongPcListProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={`${items.length}축`}>고정 주성분</SectionTitle>
      <div className="flex flex-col gap-[7px]">
        {items.map((pc) => (
          <ProgressBar key={pc.label} label={pc.label} code={pc.label} percent={((pc.value + 1) / 2) * 100} valueText={pc.value.toFixed(2)} />
        ))}
      </div>
    </div>
  );
}
