"use client";

import Button from "@/components/common/button";
import Tag from "@/components/common/tag";
import { useLikeContestEntryMutation } from "@/hooks/mutations/use-like-contest-entry-mutation";
import { useSaveContestEntryMutation } from "@/hooks/mutations/use-save-contest-entry-mutation";
import { ownerLabel, roundPhase } from "@/lib/contest-view";
import { formatTimeAgo } from "@/lib/format";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";

/** 썸네일 한 변. 카드 최소 폭 210 - 안쪽 여백 16 (`gallery-tab` 의 minmax 와 맞춘다) */
const THUMB = 194;

interface EntryCardProps {
  entry: ContestEntry;
  contest: Contest;
  /** 로그인한 내 이메일. 없으면 비로그인 — 좋아요를 줄 수 없다 */
  meEmail: string | null;
}

/**
 * 갤러리 카드 — 썸네일 · 이름 · 만든 사람 · AI 한 줄 평 · 좋아요 · 가져오기 (S15P21A405-640).
 * 좋아요가 곧 표다 (S15P21A405-616): 회차당 남의 작품 `voteLimit`개, 내 작품 금지. 백엔드가 닉네임을 안 줘서 주인은 이메일 앞부분이다.
 */
export default function EntryCard({ entry, contest, meEmail }: EntryCardProps) {
  const toast = useToastStore((s) => s.show);
  const like = useLikeContestEntryMutation();
  const save = useSaveContestEntryMutation();
  const isMine = meEmail != null && entry.ownerEmail === meEmail;
  const open = roundPhase(contest) === "OPEN";

  const handleLike = () => {
    if (!meEmail) return toast("로그인하면 좋아요를 줄 수 있어요");
    if (!entry.likedByMe && contest.myVotesLeft === 0) return toast("좋아요를 모두 썼어요. 다른 별자리의 좋아요를 거두면 다시 줄 수 있어요");
    like.mutate({ artworkId: entry.artworkId, liked: !entry.likedByMe }, { onError: (e) => toast(e.message) });
  };

  const handleSave = () => {
    if (!meEmail) return toast("로그인하면 내 플레이리스트로 가져올 수 있어요");
    save.mutate(
      { playlistName: entry.title, musicIds: entry.tracks.map((t) => t.musicId) },
      { onSuccess: () => toast(`「${entry.title}」 곡 ${entry.tracks.length}개를 내 플레이리스트로 복사했어요 · 순서 그대로`), onError: (e) => toast(e.message) },
    );
  };

  return (
    <article className={`flex flex-col gap-2 rounded-box-sm border p-2 ${isMine ? "border-teal/40 bg-teal/[.05]" : "border-line bg-white/[.03]"}`}>
      <ConstellationThumb tracks={entry.tracks} closed={entry.closed} size={THUMB} className="self-center" />
      <div className="flex items-center justify-between gap-1.5">
        <p className="min-w-0 truncate text-sm font-medium">{entry.title}</p>
        {isMine ? <Tag tone="teal">내 출품</Tag> : entry.rank != null ? <Tag title="순위">{entry.rank}위</Tag> : null}
      </div>
      <p className="truncate text-[12px] text-ink-3">
        @{ownerLabel(entry.ownerEmail)} · {entry.musicCnt}곡 · {formatTimeAgo(entry.createdAt)}
      </p>
      {entry.aiComment && <p className="line-clamp-2 text-xs leading-relaxed text-ink-3">“{entry.aiComment}”</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="num text-xs">
          <b className="text-ink">{entry.score ?? "–"}</b>
          <span className="text-ink-4"> AI</span>
          {entry.rankScore != null && <span className="text-ink-3"> · 순위 점수 {entry.rankScore.toFixed(1)}</span>}
        </span>
        <Button
          size="sm"
          active={entry.likedByMe}
          disabled={isMine || !open || like.isPending}
          title={isMine ? "내 작품에는 좋아요를 줄 수 없어요" : entry.likedByMe ? "좋아요 거두기" : "좋아요"}
          onClick={handleLike}
        >
          {entry.likedByMe ? "♥" : "♡"} <span className="num">{entry.likeCnt}</span>
        </Button>
      </div>
      <Button size="sm" variant="secondary" className="w-full" disabled={save.isPending || entry.tracks.length === 0} onClick={handleSave}>
        내 플리로 가져오기
      </Button>
    </article>
  );
}
