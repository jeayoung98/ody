"use client";

import EmptyState from "@/components/common/empty-state";
import UserRow from "@/components/common/user-row";
import { formatCount } from "@/lib/format";
import { useOpenProfile } from "@/hooks/use-open-profile";
import type { UserRankingItem } from "@/types";

interface UserRankingListProps {
  items: UserRankingItem[];
  /** `score` 의 단위 — 종류마다 다르다 (곡 / 회 / 건 / 명) */
  unit: string;
  /** 빈 목록 문구 — 주간 랭킹과 버스기사가 다르다 (S15P21A405-681) */
  emptyMessage: string;
}

/** 랭킹 목록 한 종류. 순서는 서버가 정한 그대로 그린다 — 다시 정렬하지 않는다 */
export default function UserRankingList({ items, unit, emptyMessage }: UserRankingListProps) {
  const openProfile = useOpenProfile();
  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <>
      {items.map((u) => (
        <UserRow key={u.email} prefix={u.rank} nickname={u.nickname} imageUrl={u.imageUrl} right={`${formatCount(u.score)} ${unit}`} onClick={() => openProfile(u.email, { drill: true })} />
      ))}
    </>
  );
}
