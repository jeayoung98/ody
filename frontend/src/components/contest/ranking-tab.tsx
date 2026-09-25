"use client";

import Button from "@/components/common/button";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Note from "@/components/common/note";
import SkeletonRows from "@/components/common/skeleton-rows";
import TrackRow from "@/components/common/track-row";
import { useSaveContestEntryMutation } from "@/hooks/mutations/use-save-contest-entry-mutation";
import { useContestEntriesQuery } from "@/hooks/queries/use-contest-entries-query";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { ownerLabel, roundPhase } from "@/lib/contest-view";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";

/**
 * 순위 — 리더보드 그대로 (S15P21A405-616 · 640). 순위 점수 = 좋아요 + AI ÷ 100 × K (K 회차별, 기본 5).
 * 동점은 AI 점수 → 먼저 낸 순. 발표 시각·최종 고정은 백엔드 범위 밖이라 접수 중에는 계속 바뀐다.
 */
export default function RankingTab({ contest }: { contest: Contest }) {
  const { data, isPending, isError } = useContestEntriesQuery();
  const { data: me } = useMeQuery();
  const toast = useToastStore((s) => s.show);
  const save = useSaveContestEntryMutation();

  const handleSave = (e: ContestEntry) => {
    if (!me) return toast("로그인하면 내 플레이리스트로 가져올 수 있어요");
    save.mutate(
      { playlistName: e.title, musicIds: e.tracks.map((t) => t.musicId) },
      { onSuccess: () => toast(`「${e.title}」 곡 ${e.tracks.length}개를 내 플레이리스트로 복사했어요`), onError: (err) => toast(err.message) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Note>
        순위 점수 = <b>좋아요 수</b> + <b>AI 점수 ÷ 100 × K</b> (K 는 회차별, 기본 5 — AI 만점이 좋아요 5개와 같아요). 동점은 AI 점수 → 먼저 낸 순.
        {roundPhase(contest) === "OPEN" && " 접수 중이라 실시간으로 바뀌어요."}
      </Note>
      {isPending && <SkeletonRows count={5} thumb="square" />}
      {isError && <ErrorMessage />}
      {data && data.items.length === 0 && <EmptyState message="아직 순위가 없어요." />}
      {data && (
        <div className="-mx-1.5 flex flex-col gap-0.5">
          {data.items.map((e) => {
            const isMine = me != null && e.ownerEmail === me.email;
            return (
              <div key={e.artworkId} className="flex items-center gap-1.5">
                <ConstellationThumb tracks={e.tracks} closed={e.closed} size={40} className="ml-1" />
                <div className="min-w-0 flex-1">
                  <TrackRow
                    index={e.rank ?? undefined}
                    title={e.title}
                    artist={`@${ownerLabel(e.ownerEmail, e.ownerNickname)}${isMine ? " · 나" : ""}`}
                    active={isMine}
                    right={
                      <>
                        AI {e.score ?? "–"} · ♥ {e.likeCnt}
                        <br />
                        <b className="text-ink">{e.rankScore?.toFixed(1) ?? "–"}</b>
                      </>
                    }
                    actions={
                      <Button size="sm" variant="ghost" title="내 플리로 가져오기" disabled={save.isPending || e.tracks.length === 0} onClick={() => handleSave(e)}>
                        ＋ 플리
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
