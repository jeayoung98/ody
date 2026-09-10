import ProgressBar from "@/components/common/progress-bar";
import SectionTitle from "@/components/common/section-title";
import Stat from "@/components/common/stat";
import type { ProfileDashboard } from "@/types";

/** [대시보드] 탐험한 곡 수 · 발견한 곡 수 · 선호 분위기 */
export default function FeedDashboard({ dashboard }: { dashboard: ProfileDashboard }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>대시보드</SectionTitle>
      <dl className="m-0">
        <Stat label="탐험한 곡 (재생)" value={`${dashboard.exploredCount.toLocaleString()}곡`} numeric />
        <Stat label="발견한 곡 (처음 재생)" value={`${dashboard.discoveredCount.toLocaleString()}곡`} numeric />
      </dl>
      <SectionTitle>선호 분위기</SectionTitle>
      <div className="flex flex-col gap-[7px]">
        {dashboard.moodPreference.map((m) => (
          <ProgressBar key={m.mood} label={m.mood} percent={m.percent} />
        ))}
      </div>
    </div>
  );
}
