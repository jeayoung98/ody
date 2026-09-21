import Stat from "@/components/common/stat";
import type { ProfileDashboard } from "@/types";

/**
 * [대시보드] 탐험한 곡 수 · 발견한 곡 수 (S15P21A405-524).
 *
 * **제목 글자와 선호 분위기를 뺐다.** 제목은 두 줄짜리 숫자 위에 붙는 라벨이라 없어도 읽히고,
 * 선호 분위기 막대는 자리를 크게 먹는 데 비해 보는 사람이 할 일이 없었다. 화면의 중심을
 * 플리 목록에 주기로 했다.
 */
export default function FeedDashboard({ dashboard }: { dashboard: ProfileDashboard }) {
  return (
    <dl className="m-0">
      <Stat label="탐험한 곡 (재생)" value={`${dashboard.exploredCount.toLocaleString()}곡`} numeric />
      <Stat label="발견한 곡 (처음 재생)" value={`${dashboard.discoveredCount.toLocaleString()}곡`} numeric />
    </dl>
  );
}
