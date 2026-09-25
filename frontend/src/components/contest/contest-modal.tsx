"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Box from "@/components/common/box";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import SkeletonRows from "@/components/common/skeleton-rows";
import UnderlineTabs from "@/components/common/underline-tabs";
import { CONTEST_TABS } from "@/constants";
import { useContestCurrentQuery } from "@/hooks/queries/use-contest-current-query";
import { useContestStore } from "@/stores/use-contest-store";
import ContestHeader from "./contest-header";
import GalleryTab from "./gallery-tab";
import RankingTab from "./ranking-tab";
import SketchTab from "./sketch-tab";

/**
 * 이벤트 — 별자리 콘테스트 (S15P21A405-602). **화면 대부분을 덮는 모달**이다.
 *
 * 우측 패널이 아니다 (기획 확인, 2026-09-23). 패널은 지도 옆에 딸린 화면인데 이벤트는 지도와
 * 상관없는 **별개의 일**이라, 376px 안에 그리기·갤러리·순위를 구겨 넣지 않고 따로 펼친다.
 * 도움말·신고 팝업처럼 `document.body` 에 그린다 — 지도 HUD 의 transform 안에 갇히지 않게.
 * 바깥을 누르거나 Esc 로 닫힌다. 그리다 만 것은 스토어에 남아 다시 열면 그대로다.
 * 폰에서는 여백 없이 화면을 다 쓴다.
 */
export default function ContestModal() {
  const open = useContestStore((s) => s.open);
  const close = useContestStore((s) => s.close);
  const tab = useContestStore((s) => s.tab);
  const setTab = useContestStore((s) => s.setTab);
  const { data: contest, isPending, isError } = useContestCurrentQuery();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6 backdrop-blur-sm max-tablet:p-0" onClick={close} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="이벤트 · 별자리 콘테스트"
        className="animate-tin flex h-[min(820px,100%)] w-[min(1120px,100%)] flex-col max-tablet:h-full max-tablet:w-full [&>section]:h-full max-tablet:[&>section]:rounded-none!"
      >
        <Box
          title={
            <span className="flex items-baseline gap-2">
              이벤트
              <span className="lbl">별자리 콘테스트</span>
            </span>
          }
          actions={
            <IconButton label="닫기" onClick={close}>
              <CloseIcon />
            </IconButton>
          }
        >
          {isPending && <SkeletonRows count={4} thumb="none" />}
          {isError && <ErrorMessage />}
          {contest === null && <EmptyState message="지금 진행 중인 이벤트가 없어요. 다음 회차를 기다려 주세요." />}
          {contest && (
            <>
              <ContestHeader contest={contest} />
              <UnderlineTabs items={CONTEST_TABS} value={tab} onChange={setTab} />
              {/* 그리기 탭은 남은 높이를 받아 제 안에서 배치한다 (S15P21A405-665) — Box 본문은 flex 세로라 `flex-1` 이 먹는다 */}
              {tab === "sketch" && <SketchTab contest={contest} />}
              {tab === "gallery" && <GalleryTab contest={contest} />}
              {tab === "ranking" && <RankingTab contest={contest} />}
            </>
          )}
        </Box>
      </div>
    </div>,
    document.body,
  );
}
