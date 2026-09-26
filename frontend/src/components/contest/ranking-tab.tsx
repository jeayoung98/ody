"use client";

import Button from "@/components/common/button";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import Note from "@/components/common/note";
import SkeletonRows from "@/components/common/skeleton-rows";
import TrackRow from "@/components/common/track-row";
import { useContestEntriesQuery } from "@/hooks/queries/use-contest-entries-query";
import { useContestLike } from "@/hooks/use-contest-like";
import { useSaveContestToPlaylist } from "@/hooks/use-save-contest-to-playlist";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { ownerLabel, roundPhase } from "@/lib/contest-view";
import type { Contest, ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";
import RankingPodium from "./ranking-podium";
import SaveToPlaylistButton from "./save-to-playlist-button";

/**
 * 순위 — 리더보드 그대로 (S15P21A405-616 · 640). 순위 점수 = 좋아요 + AI ÷ 100 × K (K 회차별, 기본 5).
 * 동점은 AI 점수 → 먼저 낸 순. 발표 시각·최종 고정은 백엔드 범위 밖이라 접수 중에는 계속 바뀐다.
 *
 * **1~3위는 시상대로, 4위부터 목록으로** (S15P21A405-702). 좋아요는 둘 다에서 바로 준다(`useContestLike`).
 */
export default function RankingTab({ contest }: { contest: Contest }) {
  const { data, isPending, isError } = useContestEntriesQuery();
  const { data: me } = useMeQuery();
  const like = useContestLike(contest, me?.email ?? null);

  // 가져오기 규칙(넣으면 끄기 · 이미 있으면 알리기)은 갤러리와 같은 훅이다 (S15P21A405-702)
  const saver = useSaveContestToPlaylist(!!me);
  const saveButton = (e: ContestEntry) => <SaveToPlaylistButton saved={saver.isSaved(e.artworkId)} pending={saver.savingId === e.artworkId} empty={e.tracks.length === 0} onClick={() => saver.save(e)} />;

  return (
    <div className="flex flex-col gap-3">
      <Note>
        순위 점수 = <b>좋아요 수</b> + <b>AI 점수 ÷ 100 × K</b> (K 는 회차별, 기본 5 — AI 만점이 좋아요 5개와 같아요). 동점은 AI 점수 → 먼저 낸 순.
        {roundPhase(contest) === "OPEN" && " 접수 중이라 실시간으로 바뀌어요."}
      </Note>
      {isPending && <SkeletonRows count={5} thumb="square" />}
      {isError && <ErrorMessage />}
      {data && data.items.length === 0 && <EmptyState message="아직 순위가 없어요." />}
      {data && data.items.length > 0 && (
        <RankingPodium top={data.items.slice(0, 3)} meEmail={me?.email ?? null} onLike={like.toggle} canLike={like.canLike} likePending={like.pending} saveButton={saveButton} />
      )}
      {data && data.items.length > 3 && (
        <div className="-mx-1.5 flex flex-col gap-0.5">
          {data.items.slice(3).map((e) => {
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
                      <>
                        <Button size="sm" variant="ghost" active={e.likedByMe} disabled={!like.canLike(e) || like.pending} title={isMine ? "내 작품에는 좋아요를 줄 수 없어요" : e.likedByMe ? "좋아요 거두기" : "좋아요"} onClick={() => like.toggle(e)}>
                          {e.likedByMe ? "♥" : "♡"}
                        </Button>
                        {saveButton(e)}
                      </>
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
