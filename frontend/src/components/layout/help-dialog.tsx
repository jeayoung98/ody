"use client";

import { usePathname, useRouter } from "next/navigation";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import { CloseIcon } from "@/components/common/icons";
import IconButton from "@/components/common/icon-button";
import { LAYER_COUNT, NEARBY_COUNT, ROUTES, STORAGE_KEYS } from "@/constants";
import { useFeatures } from "@/hooks/use-features";
import { useSurveyMode } from "@/hooks/use-survey-mode";
import { removeStorage } from "@/lib/storage";

/**
 * 감춘 기능은 설명에서도 뺀다 (S15P21A405-333) — 안내를 읽고 찾아 나섰는데 없으면 그게 버그로 읽힌다.
 * `when` 이 없으면 항상 보인다.
 *
 * 모듈 상수였는데 함수로 내렸다 (S15P21A405-387) — 설문 모드는 런타임에 바뀌어서, 모듈이
 * 처음 불릴 때 한 번 굳히면 모드를 꺼도 설명이 감춘 상태 그대로 남는다.
 */
function helpItems(features: ReturnType<typeof useFeatures>) {
  return [
    { icon: "🗺️", title: "지도", body: `음악을 좌표로 만든 별지도예요. ${LAYER_COUNT}개의 레이어가 있고, 각 레이어는 2개의 축으로 이루어져요.` },
    { icon: "⭐", title: "별", body: "별 하나가 곡 하나예요. 색은 장르, 크기와 밝기는 재생수에 따라 달라져요." },
    { icon: "🔍", title: "파고들기", body: "확대하다 일정 이상 들어가면 다음 레이어로 파고들어요. 새 축 2개가 추가되며 좌표가 재정렬돼요." },
    { icon: "📡", title: "주변 탐색", body: `선택한 곡과 가장 가까운 ${NEARBY_COUNT}곡을 선으로 이어서 보여줘요. 줌아웃하면 해제돼요.` },
    {
      icon: "✨",
      title: "별자리",
      body: features.playlist
        ? "여정이나 플레이리스트처럼 곡 뭉치가 있을 때 별을 선으로 이어 별자리처럼 보여줘요."
        : "여정처럼 곡 뭉치가 있을 때 별을 선으로 이어 별자리처럼 보여줘요.",
    },
    { icon: "📍", title: "내 위치", body: "청록색 마름모가 나예요. 별을 클릭하면 그 곡이 재생되면서 내 위치가 그리로 옮겨지고, 화면도 내 위치로 정렬돼요." },
    {
      icon: "🚀",
      title: "따라가기",
      body: "다른 사람의 우주선에 탑승해 탐색 여정을 함께해요. 탑승 중엔 지도 조작이 잠기고 하차 버튼으로 내릴 수 있어요.",
      when: features.social,
    },
  ].filter((item) => item.when !== false);
}

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const items = helpItems(useFeatures());
  /**
   * 테스트 안내 화면은 한 번 보면 다시 안 뜬다 — 본 표식을 지워야 돌아간다 (S15P21A405-392).
   * 거기에 **이번 테스트에서 무엇을 보는지와 필수 설문 2개** 가 적혀 있어서, 지나친 테스터가
   * 다시 읽을 길이 있어야 한다. 표식을 지우고 보내면 `TutorialEntry` 가 알아서 안내부터 띄운다.
   */
  const surveyMode = useSurveyMode();
  const pathname = usePathname();
  const replayGuide = () => {
    removeStorage(STORAGE_KEYS.testGuideSeen);
    // 이미 튜토리얼 화면이면 push 가 아무것도 안 한다 — 다시 올리려면 새로 그려야 한다
    if (pathname === ROUTES.tutorial) window.location.reload();
    else router.push(ROUTES.tutorial);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md animate-tin">
        <Box
          title="ODY 사용법"
          code="help"
          actions={
            <IconButton label="닫기" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          }
          footer={
            /* 튜토리얼·안내 화면 둘 다 첫 진입에 한 번만 뜬다. 잊었을 때 돌아올 입구가 여기뿐이다 */
            <div className="flex gap-2">
              {/* 안내 화면은 설문 모드에서만 뜬다 — 모드를 끄면 갈 곳이 없으니 버튼도 감춘다 */}
              {surveyMode && (
                <Button className="flex-1" onClick={replayGuide}>
                  가이드 다시보기
                </Button>
              )}
              <Button className="flex-1" onClick={() => router.push(ROUTES.tutorial)}>
                튜토리얼 다시보기
              </Button>
            </div>
          }
        >
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.title} className="flex gap-3 text-sm">
                <span className="text-xl leading-none">{item.icon}</span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs leading-relaxed text-ink-2">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Box>
      </div>
    </div>
  );
}
