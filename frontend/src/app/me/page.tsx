import PanelScreen from "@/components/layout/panel-screen";
import FeedPanel from "@/components/panels/feed/feed-panel";

/**
 * 마이페이지 탭 (USER-02·04, S15P21A405-417). **좁은 화면에서만 온다** — 데스크톱은 같은
 * 컴포넌트를 우측 패널로 연다. 남의 프로필은 여전히 패널로 뜬다 (지도에서 사람을 누르는 길).
 *
 * `self` 는 **이 주소는 언제나 내 페이지**라는 뜻이다 (S15P21A405-577). 탭은 주소만 옮기는데
 * 피드는 스토어의 `profileEmail` 을 보고 있어서, 남의 프로필을 한 번 열어 본 뒤 마이페이지를
 * 누르면 **그 사람 피드가 그대로 떴다.**
 */
export default function MePage() {
  return (
    <PanelScreen panel="feed">
      <FeedPanel self />
    </PanelScreen>
  );
}
