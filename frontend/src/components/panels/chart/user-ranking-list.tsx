"use client";

import EmptyState from "@/components/common/empty-state";
import UserRow from "@/components/common/user-row";
import { formatCount } from "@/lib/format";
import { usePanelStore } from "@/stores/use-panel-store";
import type { UserRankingItem } from "@/types";

interface UserRankingListProps {
  items: UserRankingItem[];
  /** `score` 의 단위 — 종류마다 다르다 (곡 / 회 / 건) */
  unit: string;
}

/** 랭킹 목록 한 종류. 데이터는 부모가 한 번에 받아 넘긴다 (세 랭킹이 한 응답) */
export default function UserRankingList({ items, unit }: UserRankingListProps) {
  const openFeed = usePanelStore((s) => s.openFeed);
  if (items.length === 0) return <EmptyState message="이번 주에는 아직 기록이 없어요." />;

  return (
    <>
      {items.map((u) => (
        <UserRow key={u.email} prefix={u.rank} nickname={u.nickname} imageUrl={u.imageUrl} right={`${formatCount(u.score)} ${unit}`} onClick={() => openFeed(u.email)} />
      ))}
    </>
  );
}
