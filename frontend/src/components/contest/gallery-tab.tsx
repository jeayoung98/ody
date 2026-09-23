"use client";

import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import SkeletonRows from "@/components/common/skeleton-rows";
import Tag from "@/components/common/tag";
import { useContestEntriesQuery } from "@/hooks/queries/use-contest-entries-query";
import { useContestStore } from "@/stores/use-contest-store";
import type { Contest } from "@/types";
import EntryCard from "./entry-card";
import SortSelect from "./sort-select";

/** 갤러리 — 정렬 · 남은 표 · 출품작 카드 두 줄 */
export default function GalleryTab({ contest }: { contest: Contest }) {
  const sort = useContestStore((s) => s.sort);
  const setSort = useContestStore((s) => s.setSort);
  const { data, isPending, isError } = useContestEntriesQuery(contest.id, sort);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SortSelect value={sort} onChange={setSort} />
        <Tag tone={contest.myVotesLeft > 0 ? "teal" : "default"} title={`회차당 ${contest.rules.voteLimit}표 · 내 출품작 제외`}>
          남은 표 <span className="num">{contest.myVotesLeft}</span>
        </Tag>
      </div>
      {isPending && <SkeletonRows count={4} thumb="square" />}
      {isError && <ErrorMessage />}
      {data && data.length === 0 && <EmptyState message="아직 출품작이 없어요. 첫 별자리를 그려 보세요." />}
      {data && data.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 max-tablet:grid-cols-2">
          {data.map((e) => (
            <EntryCard key={e.id} entry={e} contest={contest} />
          ))}
        </div>
      )}
    </div>
  );
}
