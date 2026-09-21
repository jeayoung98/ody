"use client";

import EmptyState from "@/components/common/empty-state";
import SkeletonRows from "@/components/common/skeleton-rows";
import UserRow from "@/components/common/user-row";
import type { ChartType } from "@/constants";
import { useUserRankingQuery } from "@/hooks/queries/use-ranking-query";
import { formatCount } from "@/lib/format";
import { usePanelStore } from "@/stores/use-panel-store";

const UNIT: Record<Exclude<ChartType, "topPlaylist">, string> = { topDriver: "동승", topExplorer: "곡", topFollowed: "명" };

export default function UserRankingList({ type }: { type: Exclude<ChartType, "topPlaylist"> }) {
  const { data, isPending } = useUserRankingQuery(type);
  const openFeed = usePanelStore((s) => s.openFeed);

  if (isPending) return <SkeletonRows count={5} thumb="circle" sub={false} />;
  if (!data || data.length === 0) return <EmptyState message="아직 랭킹이 없어요." />;

  return (
    <>
      {data.map((u) => (
        <UserRow
          key={u.email}
          prefix={u.rank}
          nickname={u.nickname}
          imageUrl={u.imageUrl}
          right={`${formatCount(u.score)} ${UNIT[type]}`}
          onClick={() => openFeed(u.email)}
        />
      ))}
    </>
  );
}
