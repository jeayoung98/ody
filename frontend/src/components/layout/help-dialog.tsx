"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import { ChevronLeftIcon, CloseIcon } from "@/components/common/icons";
import IconButton from "@/components/common/icon-button";
import { NEARBY_COUNT, ROUTES, STORAGE_KEYS } from "@/constants";
import { useSurveyMode } from "@/hooks/use-survey-mode";
import { removeStorage } from "@/lib/storage";

interface GuideCard {
  key: string;
  icon: string;
  title: string;
  body: string;
  /**
   * `public/` 아래 경로. **GIF 가 아니라 mp4 다** — 같은 화면이 GIF 보다 10~50배 작다
   * (실측: 2582x1556 GIF 69MB). 파일이 없으면 자리만 비운다.
   */
  clip: string;
}

/**
 * 안내 카드 — **한 번에 하나씩** 넘겨 본다 (S15P21A405-436).
 *
 * 예전에는 7개 항목을 한 목록에 텍스트로 주룩 나열했다. 파고들기·주변 탐색·별자리처럼
 * **움직임을 봐야 이해되는 것들**이 한 줄 설명으로 묻혀 있었다. 카드로 나누고 항목마다
 * GIF 를 두면 "무엇을 하면 그렇게 되는지" 가 보인다.
 *
 * 묶음은 **개념 → 기능** 순이다. 지도·별·내 위치·파고들기는 따로 떨어진 기능이 아니라
 * *별을 누르면 내가 그리로 가고, 거기서 확대하면 파고든다* 는 **하나의 흐름**이라 한 장에 담는다.
 * 주변 탐색과 여정은 목적이 달라 나눈다 — 하나는 "이 곡 옆에 뭐가 있지", 하나는 "여기서 저기까지".
 *
 * **따라가기 카드가 열렸다** (S15P21A405-530). 탑승·하차가 배포 백엔드에 올라가 실제로 도므로,
 * 켜야 보이던 조건(`showFollowCard`·`ody:guide-follow`·`GuideCard.when`)을 함께 걷어냈다 —
 * 조건부 카드는 지금 하나도 없고, 쓰지 않는 갈래는 다음 사람이 해석해야 할 짐이다.
 *
 * 모듈 상수가 아니라 함수다 (S15P21A405-387) — 설문 모드는 런타임에 바뀌어서, 모듈이 처음
 * 불릴 때 한 번 굳히면 모드를 꺼도 설명이 감춘 상태 그대로 남는다.
 */

function guideCards(): GuideCard[] {
  return [
    {
      key: "map",
      icon: "🗺️",
      title: "별지도",
      clip: "/guide/map.mp4",
      /*
       * **색·크기 얘기는 뺐다** (S15P21A405-436). 예전 문구에 "색은 장르, 크기와 밝기는 재생수"
       * 라고 적혀 있었는데 지금 실데이터로는 둘 다 사실이 아니다 — 2026-09-18 확인:
       * `genreId` 가 750곡 전부 10(무장르 회색), `weight` 도 전부 0(균일)이다.
       * 화면에 보이는 색색깔 별은 곡이 아니라 배경 장식이다. 값이 들어오면 그때 한 줄 되살린다.
       *
       * "누르면 재생" 도 아니다. `map-view.tsx` `pressSong` 기준으로 **첫 클릭은 선택(상세),
       * 이미 고른 별을 다시 눌러야 재생**이다 (S15P21A405-288·393).
       */
      body: "별 하나가 곡 하나예요. 한 번 누르면 **곡 정보**가 열려요.\n한 번 더 누르면 **재생**되고, 내 위치가 그 별로 옮겨가요.",
    },
    {
      key: "drill",
      icon: "🔍",
      title: "파고들기",
      clip: "/guide/drill.mp4",
      body: "계속 확대하면 다음 레이어로 **파고들어요**.\n새 축 2개가 추가되며 좌표가 재정렬돼요.",
    },
    {
      key: "nearby",
      icon: "📡",
      title: "주변 탐색",
      clip: "/guide/nearby.mp4",
      body: `고른 곡과 소리가 가장 가까운 **${NEARBY_COUNT}곡**을 선으로 이어줘요.`,
    },
    {
      key: "journey",
      icon: "🧭",
      title: "여정",
      clip: "/guide/journey.mp4",
      body: "출발 곡과 도착 곡을 정하면 그 사이를 잇는 **경로**가 나와요.\n별을 하나씩 이동하며 소리의 변화에 집중해보세요.",
    },
    {
      key: "follow",
      icon: "🚀",
      title: "따라가기",
      clip: "/guide/follow.mp4",
      body: "다른 사람의 우주선에 **탑승**해 탐색 여정을 함께해요. 탑승 중엔 지도 조작이 잠기고 **하차** 버튼으로 내릴 수 있어요.",
    },
  ];
}

/** `**굵게**` 만 해석한다 — 문구에서 한두 단어를 짚는 용도다 */
function emphasize(body: string) {
  return body.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-medium text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const cards = guideCards();
  const [at, setAt] = useState(0);
  const last = cards.length - 1;
  const go = useCallback((d: number) => setAt((v) => Math.min(last, Math.max(0, v + d))), [last]);
  /** 좌우 화살표로도 넘긴다 — 카드가 여러 장이라는 걸 키보드로 먼저 알아채는 사람이 있다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

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

  const card = cards[Math.min(at, last)];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-tin w-full max-w-md">
        {/*
          헤더가 곧 카드 제목이다 — 넘길 때마다 바뀐다. "ODY 사용법" 은 넣지 않는다: 도움말 버튼으로
          연 창이라 이미 알고 들어왔고, 제목을 두 번 쓰면 그만큼 영상과 문구가 아래로 밀린다.
          크기는 Box 헤더의 h2(font-display text-lg)가 잡는다 — 여기서 따로 주지 않는다.
        */}
        <Box
          title={`${card.icon} ${card.title}`}
          actions={
            <IconButton label="닫기" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          }
          footer={
            <div className="flex flex-col gap-3">
              {/* 넘기기 — 점으로 몇 장 중 몇 번째인지 같이 보여준다 */}
              <div className="flex items-center justify-between">
                <IconButton label="이전" className="disabled:pointer-events-none disabled:opacity-25" onClick={() => go(-1)} disabled={at === 0}>
                  <ChevronLeftIcon />
                </IconButton>
                <div className="flex gap-1.5">
                  {cards.map((c, i) => (
                    <button
                      key={c.key}
                      aria-label={`${i + 1}번째 ${c.title}`}
                      onClick={() => setAt(i)}
                      className={`h-1.5 rounded-pill transition-all ${i === at ? "w-4 bg-ink" : "w-1.5 bg-line-2 hover:bg-ink-3"}`}
                    />
                  ))}
                </div>
                <IconButton label="다음" className="disabled:pointer-events-none disabled:opacity-25" onClick={() => go(1)} disabled={at === last}>
                  <span className="block rotate-180">
                    <ChevronLeftIcon />
                  </span>
                </IconButton>
              </div>
              {/* 튜토리얼·안내 화면 둘 다 첫 진입에 한 번만 뜬다. 잊었을 때 돌아올 입구가 여기뿐이다 */}
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
            </div>
          }
        >
          <div key={card.key} className="animate-tfade flex flex-col gap-2.5">
            {/*
              동작을 보여주는 짧은 영상. **GIF 가 아니라 mp4 다** — 같은 화면을 GIF 로 담으면
              10~50배 커진다 (실측: 2582x1556 GIF 가 69MB). 저장소에 들어가는 것이라 크기가
              곧 팀원 모두의 clone 비용이고, git 히스토리는 지워도 남는다.
              Windows 는 `Win + Alt + R`(Xbox Game Bar)이 mp4 로 바로 뽑아 준다.

              파일이 없으면 `onError` 로 스스로 감춰 **자리만 비운다** — 넣기 전에도 문구는
              읽히고 레이아웃이 깨지지 않는다. 16:9 로 고정해 장마다 높이가 튀지 않게 한다.

              `muted` 없이는 `autoPlay` 가 브라우저에 막힌다. `playsInline` 은 iOS 가 전체화면으로
              띄우는 것을 막는다. 소리는 어차피 안 쓴다.
            */}
            <div className="relative aspect-video w-full overflow-hidden rounded-box-sm border border-line bg-void-2">
              <video
                src={card.clip}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            {/* `whitespace-pre-line` 이라 body 안의 \n 이 그대로 줄바꿈이 된다 — 문장을 끊는 자리는 문구를 쓰는 사람이 정한다 */}
            <p className="text-md leading-relaxed whitespace-pre-line text-ink-2">{emphasize(card.body)}</p>
          </div>
        </Box>
      </div>
    </div>
  );
}
