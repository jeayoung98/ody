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
  /**
   * **모르는 값은 그리지 않는다** (S15P21A405-531). 0곡 이라고 적으면 "한 곡도 안 들었다" 는
   * 없는 사실이 된다. 처음 재생한 곡 수는 아직 백엔드에 없어서 늘 비어 있다.
   */
  const rows = [
    { label: "탐험한 곡 (재생)", value: dashboard.exploredCount },
    { label: "발견한 곡 (처음 재생)", value: dashboard.discoveredCount },
  ].filter((r) => r.value != null);
  if (rows.length === 0) return null;

  return (
    <dl className="m-0">
      {rows.map((r) => (
        <Stat key={r.label} label={r.label} value={`${r.value!.toLocaleString()}곡`} numeric />
      ))}
    </dl>
  );
}
