import PanelScreen from "@/components/layout/panel-screen";
import FeedPanel from "@/components/panels/feed/feed-panel";

/**
 * 마이페이지 탭 (USER-02·04, S15P21A405-417). **좁은 화면에서만 온다** — 데스크톱은 같은
 * 컴포넌트를 우측 패널로 연다. 남의 프로필은 여전히 패널로 뜬다 (지도에서 사람을 누르는 길).
 */
export default function MePage() {
  return (
    <PanelScreen panel="feed">
      <FeedPanel />
    </PanelScreen>
  );
}
