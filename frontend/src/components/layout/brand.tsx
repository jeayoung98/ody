"use client";

import Logo from "@/components/common/logo";
import LayerStepper from "./layer-stepper";
import LayerSummary from "./layer-summary";
import LeadChip from "./lead-chip";
import ViewModeCrumb from "./view-mode-crumb";

/**
 * #brand — 좌상단: 로켓 마크(`common/logo`, 파비콘과 같은 얼굴) + 워드마크 + 레이어 자취 + 뷰 모드.
 *
 * `별지도 · 8 레이어` 꼬리표는 걷어냈다 (S15P21A405-477) — 여덟 겹이라는 건 바로 아래 자취가
 * 이미 말하고, 첫 화면에서만 잠깐 쓸모 있던 설명이 계속 자리를 차지했다.
 */
export default function Brand() {
  return (
    <div className="pointer-events-none absolute top-hud-t left-[18px] z-20 flex flex-col gap-[14px] max-tablet:left-gutter-sm" data-hud data-brand>
      {/*
        `self-start` 는 좁은 화면에서만 건다 (S15P21A405-417). 이 줄은 `flex-col` 의 자식이라
        **아래 레이어 자취만큼 가로로 늘어난다** — 워드마크를 감춰 보이는 건 마크 26px 뿐인데
        상자는 128px 이었다. 상자가 커지면 지도 엔진이 `[data-hud]` 를 재서 그만큼 넓게 비운다
        (`map-view.tsx` 의 `setObstacles`). 데스크톱에 걸면 그쪽 상자도 420→149 로 바뀌므로 안 건다.
      */}
      {/*
        폰 윗줄은 32px 한 줄이다 (S15P21A405-703) — 검색·주변 탐색·여정과 같은 높이라 가운데선이 맞는다.
        **폰에서는 로고를 감춘다** (사용자 결정). `hidden` 이 아니라 `invisible` 인 이유: 이 줄이 빠지면
        아래 레이어 자취가 윗줄로 올라와 검색 아이콘과 겹친다 — 자리(32px)는 남기고 모양만 지운다.
      */}
      <div className="pointer-events-auto flex items-center gap-2.5 max-tablet:invisible max-tablet:h-8 max-tablet:self-start">
        <Logo size={26} radius={22} className="shadow-[0_0_22px_-4px_rgba(92,157,255,.75)]" />
        {/*
          좁은 화면에서는 워드마크를 접는다 (S15P21A405-417). 375px 한 줄에 브랜드(128) ·
          검색(104) · 레일(222) 이 다 서려면 454px 이 필요해 79px 이 모자란다. 워드마크가
          102px 이고 **`pointer-events-none` 장식**이라 — 앱 이름은 탭 제목과 스플래시가
          이미 말한다 — 여기서 가장 먼저 접을 것이다. 마크는 남으므로 자리표시는 유지된다.
        */}
        {/* 자간 0 — 0.26em 은 26px 마크 옆에서 글자가 따로 노는 것으로 읽혔다 (S15P21A405-651) */}
        <span className="font-display text-2xl leading-none font-bold tracking-normal max-tablet:hidden">ODY</span>
      </div>
      {/* 자취와 그 설명은 한 덩어리다 — 붙여 두어야 설명이 무엇에 대한 말인지 바로 읽힌다 */}
      <div className="flex flex-col gap-[2px]">
        <LayerStepper />
        <LayerSummary />
      </div>
      {/* 폰에서 내가 태우고 있을 때 인원 한 줄 — 레이어 설명 바로 아래 (S15P21A405-703) */}
      <LeadChip />
      <ViewModeCrumb />
    </div>
  );
}
