"use client";

import Box from "@/components/common/box";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import SkeletonRows from "@/components/common/skeleton-rows";
import UnderlineTabs from "@/components/common/underline-tabs";
import { CONTEST_TABS } from "@/constants";
import { useContestCurrentQuery } from "@/hooks/queries/use-contest-current-query";
import { useContestStore } from "@/stores/use-contest-store";
import PanelCloseButton from "../panel-close-button";
import ContestHeader from "./contest-header";
import GalleryTab from "./gallery-tab";
import RankingTab from "./ranking-tab";
import SketchTab from "./sketch-tab";

/**
 * 별자리 콘테스트 (S15P21A405-602). 상단 원형 버튼이 연다.
 * 세 탭 — 그리기 / 갤러리 / 순위. 지도는 건드리지 않는다: 별자리 미리보기는 패널 안 캔버스다.
 * 기능 명세 항목은 FEATURES.md 변경 제안 #36 (CONTEST-01~05, 미확정).
 */
export default function ContestPanel() {
  const { data: contest, isPending, isError } = useContestCurrentQuery();
  const tab = useContestStore((s) => s.tab);
  const setTab = useContestStore((s) => s.setTab);

  return (
    <Box title="별자리 콘테스트" actions={<PanelCloseButton />}>
      {isPending && <SkeletonRows count={4} thumb="none" />}
      {isError && <ErrorMessage />}
      {contest === null && <EmptyState message="지금 진행 중인 콘테스트가 없어요. 다음 회차를 기다려 주세요." />}
      {contest && (
        <>
          <ContestHeader contest={contest} />
          <UnderlineTabs items={CONTEST_TABS} value={tab} onChange={setTab} />
          {tab === "sketch" && <SketchTab contest={contest} />}
          {tab === "gallery" && <GalleryTab contest={contest} />}
          {tab === "ranking" && <RankingTab contest={contest} />}
        </>
      )}
    </Box>
  );
}
