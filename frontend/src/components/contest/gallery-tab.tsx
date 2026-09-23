"use client";

import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Note from "@/components/common/note";
import SkeletonRows from "@/components/common/skeleton-rows";
import Tag from "@/components/common/tag";
import { useContestEntriesQuery } from "@/hooks/queries/use-contest-entries-query";
import { useContestMineQuery } from "@/hooks/queries/use-contest-mine-query";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { myEntry, sortEntries } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import type { Contest } from "@/types";
import EntryCard from "./entry-card";
import SortSelect from "./sort-select";

/**
 * 갤러리 — 정렬 · 남은 좋아요 · 작품 카드 (S15P21A405-640). 리더보드(`SCORED` 만)가 원본이라 채점 전인 내 작품은 여기 없다 —
 * 그 사실을 한 줄로 알려 준다.
 */
export default function GalleryTab({ contest }: { contest: Contest }) {
  const sort = useContestStore((s) => s.sort);
  const setSort = useContestStore((s) => s.setSort);
  const { data, isPending, isError } = useContestEntriesQuery();
  const { data: me } = useMeQuery();
  const { data: mine } = useContestMineQuery(!!me);
  const my = myEntry(mine);
  const items = data ? sortEntries(data.items, sort) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SortSelect value={sort} onChange={setSort} />
        {contest.myVotesLeft != null ? (
          <Tag tone={contest.myVotesLeft > 0 ? "teal" : "default"} title={`회차당 ${contest.voteLimit}개 · 내 작품 제외 · 거두면 돌아와요`}>
            남은 좋아요 <span className="num">{contest.myVotesLeft}</span>
          </Tag>
        ) : (
          <Tag title="비로그인">로그인하면 좋아요를 줄 수 있어요</Tag>
        )}
      </div>
      {my && my.status !== "SCORED" && (
        <Note>
          {my.status === "PENDING" ? `내 작품 「${my.title}」은 AI 채점이 끝나면 갤러리에 올라와요.` : `내 작품 「${my.title}」의 채점이 실패했어요 — 그리기 탭에서 다시 채점받을 수 있어요.`}
        </Note>
      )}
      {isPending && <SkeletonRows count={4} thumb="square" />}
      {isError && <ErrorMessage />}
      {items && items.length === 0 && <EmptyState message="아직 채점된 작품이 없어요. 첫 별자리를 그려 보세요." />}
      {items && items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 max-tablet:grid-cols-2">
          {items.map((e) => (
            <EntryCard key={e.artworkId} entry={e} contest={contest} meEmail={me?.email ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
