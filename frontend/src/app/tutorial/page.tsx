import MainScreen from "@/components/layout/main-screen";
import TutorialOverlay from "@/components/tutorial/tutorial-overlay";

/** 튜토리얼: 실제 지도 위에 단계별 태스크를 얹는다 (AUTH-04) */
export default function TutorialPage() {
  return <MainScreen overlay={<TutorialOverlay />} />;
}
