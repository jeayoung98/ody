"use client";

import Button from "@/components/common/button";
import Tag from "@/components/common/tag";
import { useSaveContestEntryMutation } from "@/hooks/mutations/use-save-contest-entry-mutation";
import { useVoteContestEntryMutation } from "@/hooks/mutations/use-vote-contest-entry-mutation";
import { formatTimeAgo } from "@/lib/format";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";

/** 카드 폭(패널 376 - 여백 30 - 틈 10)/2 에서 카드 안쪽 여백 16 을 뺀 값 */
const THUMB = 150;

/** 갤러리 카드 — 썸네일 · 이름 · 만든 사람 · AI 한 줄 평 · 표 · 가져오기 */
export default function EntryCard({ entry, contest }: { entry: ContestEntry; contest: Contest }) {
  const toast = useToastStore((s) => s.show);
  const vote = useVoteContestEntryMutation();
  const save = useSaveContestEntryMutation();
  const low = !entry.eligible;
  const open = contest.status === "OPEN";

  const handleVote = () => {
    if (!entry.votedByMe && contest.myVotesLeft <= 0) {
      toast("표를 모두 썼어요. 다른 별자리의 표를 거두면 다시 줄 수 있어요");
      return;
    }
    vote.mutate({ contestId: contest.id, entryId: entry.id, on: !entry.votedByMe }, { onError: (e) => toast(e.message) });
  };

  const handleSave = () => {
    if (entry.savedByMe) {
      toast(`「${entry.title}」은 이미 내 플레이리스트에 있어요`);
      return;
    }
    save.mutate(
      { contestId: contest.id, entryId: entry.id },
      {
        onSuccess: () => toast(`「${entry.title}」 곡 ${entry.tracks.length}개를 내 플레이리스트로 복사했어요 · 순서 그대로`),
        onError: (e) => toast(e.message),
      },
    );
  };

  return (
    <article className={`flex flex-col gap-2 rounded-box-sm border p-2 ${entry.isMine ? "border-teal/40 bg-teal/[.05]" : "border-line bg-white/[.03]"}`}>
      <ConstellationThumb tracks={entry.tracks} closed={entry.closed} size={THUMB} dim={low} className="self-center" />
      <div className="flex items-center justify-between gap-1.5">
        <p className="min-w-0 truncate text-sm font-medium">{entry.title}</p>
        {entry.isMine ? <Tag tone="teal">내 출품</Tag> : low ? <Tag tone="warn" title={`AI ${contest.rules.aiGate}점 미만`}>순위 제외</Tag> : null}
      </div>
      <p className="truncate text-[11px] text-ink-3">
        @{entry.ownerNickname ?? "-"} · {entry.tracks.length}곡 · {formatTimeAgo(entry.createdAt)} · {entry.saveCount}명이 가져감
      </p>
      {entry.aiComment && <p className="line-clamp-2 text-xs leading-relaxed text-ink-3">“{entry.aiComment}”</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="num text-xs">
          <b className={low ? "text-ink-3" : "text-ink"}>{entry.aiScore ?? "–"}</b>
          <span className="text-ink-4"> AI</span>
          {entry.finalScore != null && <span className="text-ink-3"> · 최종 {entry.finalScore.toFixed(1)}</span>}
        </span>
        <Button size="sm" active={entry.votedByMe} disabled={entry.isMine || !open || vote.isPending} title={entry.isMine ? "내 출품작에는 표를 줄 수 없어요" : entry.votedByMe ? "표 거두기" : "표 주기"} onClick={handleVote}>
          {entry.votedByMe ? "★" : "☆"} <span className="num">{entry.voteCount}</span>
        </Button>
      </div>
      <Button size="sm" variant={entry.savedByMe ? "ghost" : "secondary"} className="w-full" disabled={save.isPending} onClick={handleSave}>
        {entry.savedByMe ? "✓ 내 플리에 있음" : "내 플리로 가져오기"}
      </Button>
    </article>
  );
}
