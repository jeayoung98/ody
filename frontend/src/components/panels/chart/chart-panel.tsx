"use client";

import { useState } from "react";
import Box from "@/components/common/box";
import ErrorMessage from "@/components/common/error-message";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import SkeletonRows from "@/components/common/skeleton-rows";
import UnderlineTabs from "@/components/common/underline-tabs";
import { CHART_TYPES, type ChartType } from "@/constants";
import { useTopDriverRankingQuery } from "@/hooks/queries/use-top-driver-ranking-query";
import { useWeeklyRankingQuery } from "@/hooks/queries/use-weekly-ranking-query";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import TopDriverAside from "./top-driver-aside";
import UserRankingList from "./user-ranking-list";

const TAB_ITEMS = CHART_TYPES.map((c) => ({ key: c.key, label: c.short }));

const md = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/**
 * 차트 (SOCIAL-12) — **실연동** (S15P21A405-604). 발견왕·탐험왕·기여도는 백엔드
 * `GET /api/stats/weekly` 한 번으로 다 받는다. 집계 구간(월요일 00:00 ~ 다음 월요일 미만)을 제목 옆에
 * 적는다 — 주가 넘어가는 순간 어느 주인지 보이게.
 *
 * 실시간 탑 버스기사는 따로 받는다 (S15P21A405-681). 지금 상태라 제목 옆에 구간 대신 받은 시각과
 * 새로고침을 둔다. 새로고침 중에는 목록을 그대로 두고 아이콘만 돈다.
 */
export default function ChartPanel() {
  const [type, setType] = useState<ChartType>("discovery");
  const current = CHART_TYPES.find((c) => c.key === type)!;
  const isTopDriver = type === "topDriver";
  const weekly = useWeeklyRankingQuery();
  const topDriver = useTopDriverRankingQuery(isTopDriver);
  // weekEnd 는 미포함 경계라 하루 빼서 "월 ~ 일" 로 보인다
  const range = weekly.data ? `${md(weekly.data.weekStart)} ~ ${md(new Date(new Date(weekly.data.weekEnd).getTime() - 86_400_000).toISOString())}` : null;

  const { isPending, isError } = isTopDriver ? topDriver : weekly;
  const items = isTopDriver ? topDriver.data : weekly.data?.[type as Exclude<ChartType, "topDriver">];
  const aside = isTopDriver ? (
    <TopDriverAside updatedAt={topDriver.dataUpdatedAt} fetching={topDriver.isFetching && !topDriver.isPending} onRefresh={() => void topDriver.refetch()} />
  ) : (
    range ?? undefined
  );

  return (
    <Box lead={<PanelBackButton />} title="차트" actions={<PanelCloseButton />}>
      {/* 곡 상세·마이페이지와 같은 밑줄 탭 (S15P21A405-663) */}
      <UnderlineTabs items={TAB_ITEMS} value={type} onChange={setType} />
      <SectionTitle aside={aside}>{current.label}</SectionTitle>
      {/*
        **탭·제목은 붙박이, 목록만 스크롤** (S15P21A405-703). 본문이 통째로 굴러서 순위를 내리면 지금
        무슨 차트를 보는지(탭)가 위로 사라졌다. 주변 사람의 레이더와 같은 방식이다 (S15P21A405-635) —
        이 칸이 남은 높이를 받아 제 안에서만 넘치므로 바깥 본문은 굴러갈 일이 없다.
        본문 좌우·아래 여백(15·18)을 이 칸이 대신 갖는다 — 스크롤 상자가 가장자리를 자르지 않게.
      */}
      <div className="scroll-quiet -mx-[15px] -mb-[18px] flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[15px] pb-[18px] max-tablet:-mx-gutter-sm max-tablet:px-gutter-sm">
        <div className="-mx-1.5 flex flex-col gap-0.5">
          {isPending ? (
            <SkeletonRows count={5} thumb="circle" sub={false} />
          ) : isError || !items ? (
            <ErrorMessage />
          ) : (
            <UserRankingList items={items} unit={current.unit} emptyMessage={current.empty} />
          )}
        </div>
        <Note>{current.description}</Note>
      </div>
    </Box>
  );
}
