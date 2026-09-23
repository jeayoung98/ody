"use client";

import Button from "@/components/common/button";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Note from "@/components/common/note";
import SkeletonRows from "@/components/common/skeleton-rows";
import Tag from "@/components/common/tag";
import TrackRow from "@/components/common/track-row";
import { useSaveContestEntryMutation } from "@/hooks/mutations/use-save-contest-entry-mutation";
import { useContestEntriesQuery } from "@/hooks/queries/use-contest-entries-query";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";

/**
 * 순위 — `sort=final` 목록 그대로. 최종 = AI×0.5 + (표 ÷ 1위 표 × 100)×0.5, 동점은 AI 우선.
 * AI 기준 미만은 목록 끝에 순위 없이 "제외" 로 남는다. 발표 전이라 표가 바뀌면 순위도 바뀐다.
 */
export default function RankingTab({ contest }: { contest: Contest }) {
  const { data, isPending, isError } = useContestEntriesQuery(contest.id, "final");
  const toast = useToastStore((s) => s.show);
  const save = useSaveContestEntryMutation();

  const handleSave = (e: ContestEntry) => {
    if (e.savedByMe) return toast(`「${e.title}」은 이미 내 플레이리스트에 있어요`);
    save.mutate(
      { contestId: contest.id, entryId: e.id },
      { onSuccess: () => toast(`「${e.title}」 곡 ${e.tracks.length}개를 내 플레이리스트로 복사했어요`), onError: (err) => toast(err.message) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Note>
        최종 = <b>AI × 0.5</b> + <b>(내 표 ÷ 1위 표 × 100) × 0.5</b>. 동점은 AI 우선. AI {contest.rules.aiGate}점 미만은 갤러리에는 남지만 순위에서 빠져요.
        {contest.status === "OPEN" && " 발표 전이라 실시간으로 바뀌어요."}
      </Note>
      {isPending && <SkeletonRows count={5} thumb="square" />}
      {isError && <ErrorMessage />}
      {data && data.length === 0 && <EmptyState message="아직 순위가 없어요." />}
      {data && (
        <div className="-mx-1.5 flex flex-col gap-0.5">
          {data.map((e) => (
            <div key={e.id} className="flex items-center gap-1.5">
              <ConstellationThumb tracks={e.tracks} closed={e.closed} size={40} dim={!e.eligible} className="ml-1" />
              <div className="min-w-0 flex-1">
                <TrackRow
                  index={e.rank ?? undefined}
                  title={e.title}
                  artist={`@${e.ownerNickname ?? "-"}${e.isMine ? " · 나" : ""}`}
                  active={e.isMine}
                  right={
                    e.eligible ? (
                      <>
                        AI {e.aiScore} · {e.voteCount}표
                        <br />
                        <b className="text-ink">{e.finalScore?.toFixed(1)}</b>
                      </>
                    ) : (
                      <Tag tone="warn" title={`AI ${e.aiScore ?? "-"}점`}>제외</Tag>
                    )
                  }
                  actions={
                    <Button size="sm" variant="ghost" title={e.savedByMe ? "내 플리에 있음" : "내 플리로 가져오기"} disabled={save.isPending} onClick={() => handleSave(e)}>
                      {e.savedByMe ? "✓" : "＋ 플리"}
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
