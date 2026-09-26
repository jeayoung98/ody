"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Tag from "@/components/common/tag";
import { useContestLike } from "@/hooks/use-contest-like";
import { useSaveContestEntryMutation } from "@/hooks/mutations/use-save-contest-entry-mutation";
import { ownerLabel } from "@/lib/contest-view";
import { formatTimeAgo } from "@/lib/format";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";
import SaveToPlaylistButton from "./save-to-playlist-button";

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
 * 가져오기는 좋아요 옆 아이콘 버튼이다(702) — 순위 탭과 같은 버튼(`SaveToPlaylistButton`), 넣으면 꺼진다.
 * 좋아요가 곧 표다 (S15P21A405-616): 회차당 남의 작품 `voteLimit`개, 내 작품 금지.
 * 주인은 닉네임으로 적는다 (S15P21A405-645 에서 백엔드가 `ownerNickname` 을 주기 시작했다).
 */
export default function EntryCard({ entry, contest, meEmail }: EntryCardProps) {
  const toast = useToastStore((s) => s.show);
  const like = useContestLike(contest, meEmail);
  const save = useSaveContestEntryMutation();
  const isMine = meEmail != null && entry.ownerEmail === meEmail;

  /** 이 카드를 내 플리로 넣었다 — 버튼을 꺼 둔다 (S15P21A405-702, 순위 탭과 같다). 두 번 누르면 같은 플리가 둘 생긴다 */
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    if (!meEmail) return toast("로그인하면 내 플레이리스트로 가져올 수 있어요");
    if (saved) return;
    save.mutate(
      { playlistName: entry.title, musicIds: entry.tracks.map((t) => t.musicId) },
      {
        onSuccess: () => {
          setSaved(true);
          toast(`「${entry.title}」 곡 ${entry.tracks.length}개를 내 플레이리스트에 넣었어요 · 순서 그대로`);
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  return (
    <article className={`flex flex-col gap-2 rounded-box-sm border p-2 ${isMine ? "border-teal/40 bg-teal/[.05]" : "border-line bg-white/[.03]"}`}>
      <ConstellationThumb tracks={entry.tracks} closed={entry.closed} size={THUMB} className="self-center" />
      <div className="flex items-center justify-between gap-1.5">
        <p className="min-w-0 truncate text-sm font-medium">{entry.title}</p>
        {isMine ? <Tag tone="teal">내 출품</Tag> : entry.rank != null ? <Tag title="순위">{entry.rank}위</Tag> : null}
      </div>
      <p className="truncate text-[13px] text-ink-3">
        @{ownerLabel(entry.ownerEmail, entry.ownerNickname)} · {entry.musicCnt}곡 · {formatTimeAgo(entry.createdAt)}
      </p>
      {entry.aiComment && <p className="line-clamp-2 text-xs leading-relaxed text-ink-3">“{entry.aiComment}”</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="num text-xs">
          <b className="text-ink">{entry.score ?? "–"}</b>
          <span className="text-ink-4"> AI</span>
          {entry.rankScore != null && <span className="text-ink-3"> · 순위 점수 {entry.rankScore.toFixed(1)}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            active={entry.likedByMe}
            disabled={!like.canLike(entry) || like.pending}
            title={isMine ? "내 작품에는 좋아요를 줄 수 없어요" : entry.likedByMe ? "좋아요 거두기" : "좋아요"}
            onClick={() => like.toggle(entry)}
          >
            {entry.likedByMe ? "♥" : "♡"} <span className="num">{entry.likeCnt}</span>
          </Button>
          <SaveToPlaylistButton saved={saved} pending={save.isPending} empty={entry.tracks.length === 0} onClick={handleSave} />
        </div>
      </div>
    </article>
  );
}
