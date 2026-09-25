"use client";

import { useState } from "react";
import Box from "@/components/common/box";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import SkeletonRows from "@/components/common/skeleton-rows";
import UnderlineTabs from "@/components/common/underline-tabs";
import { CHART_PENDING, CHART_TYPES, type ChartType } from "@/constants";
import { useWeeklyRankingQuery } from "@/hooks/queries/use-weekly-ranking-query";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import UserRankingList from "./user-ranking-list";

const TAB_ITEMS = CHART_TYPES.map((c) => ({ key: c.key, label: c.short }));

const md = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/**
 * 차트 (SOCIAL-12) — **실연동** (S15P21A405-604). 발견왕·탐험왕·기여도는 백엔드
 * `GET /api/stats/weekly` 한 번으로 다 받는다. 실시간 탑 버스기사는 백엔드가 아직 없어 "준비 중".
 * 집계 구간(월요일 00:00 ~ 다음 월요일 미만)을 제목 옆에 적는다 — 주가 넘어가는 순간 어느 주인지 보이게.
 */
export default function ChartPanel() {
  const [type, setType] = useState<ChartType>("discovery");
  const current = CHART_TYPES.find((c) => c.key === type)!;
  const pending = CHART_PENDING.has(type);
  const { data, isPending, isError } = useWeeklyRankingQuery();
  // weekEnd 는 미포함 경계라 하루 빼서 "월 ~ 일" 로 보인다
  const range = data ? `${md(data.weekStart)} ~ ${md(new Date(new Date(data.weekEnd).getTime() - 86_400_000).toISOString())}` : null;

  return (
    <Box lead={<PanelBackButton />} title="차트" actions={<PanelCloseButton />}>
      {/* 곡 상세·마이페이지와 같은 밑줄 탭 (S15P21A405-663) */}
      <UnderlineTabs items={TAB_ITEMS} value={type} onChange={setType} />
      <SectionTitle aside={!pending && range ? range : undefined}>{current.label}</SectionTitle>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {pending ? (
          <EmptyState message="실시간 탑 버스기사는 준비 중이에요. 따라가기 집계가 열리면 여기 보여요." />
        ) : isPending ? (
          <SkeletonRows count={5} thumb="circle" sub={false} />
        ) : isError || !data ? (
          <ErrorMessage />
        ) : (
          <UserRankingList items={data[type as Exclude<ChartType, "topDriver">]} unit={current.unit} />
        )}
      </div>
      <Note>{current.description}</Note>
    </Box>
  );
}
