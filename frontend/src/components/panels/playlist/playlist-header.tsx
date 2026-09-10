"use client";

import Button from "@/components/common/button";
import { PlayIcon } from "@/components/common/icons";
import Tag from "@/components/common/tag";
import { useLikePlaylistMutation } from "@/hooks/mutations/use-like-playlist-mutation";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/stores/use-player-store";
import { useStartActivity } from "@/hooks/use-start-activity";
import type { PlaylistDetail } from "@/types";

/** 플리 제목 · 무드 태그 3개 · 곡 수 · 만든 사람 · 총 재생 시간 · 순차재생 · 좋아요 */
export default function PlaylistHeader({ playlist }: { playlist: PlaylistDetail }) {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const like = useLikePlaylistMutation();
  const startActivity = useStartActivity();
  const recordPlay = useRecordPlayMutation();

  // ACT-01: 다른 활동(따라가기·여정)이 진행 중이면 확인 후 멈추고 시작한다
  const handlePlayAll = () => {
    const ids = playlist.items.map((it) => it.musicId);
    startActivity("playlist", String(playlist.id), () => {
      playQueue({ kind: "playlist", playlistId: playlist.id }, ids);
      if (ids[0] != null) recordPlay.mutate({ musicId: ids[0], source: "PLAYLIST", playedMs: 0 });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-[17px] font-semibold">{playlist.playlistName}</h3>
      <p className="lbl">
        {playlist.ownerNickname ?? "-"} · {playlist.itemCount}곡 · {formatDuration(playlist.totalDuration)}
      </p>
      <div className="flex flex-wrap gap-[5px]">
        {playlist.moodTags.slice(0, 3).map((m) => (
          <Tag key={m} tone="violet">
            {m}
          </Tag>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={handlePlayAll} disabled={playlist.items.length === 0}>
          <PlayIcon size={13} /> 순차 재생
        </Button>
        <Button active={playlist.isLiked} onClick={() => like.mutate(playlist.id)} disabled={like.isPending}>
          {playlist.isLiked ? "♥" : "♡"} <span className="num">{playlist.likeCnt ?? 0}</span>
        </Button>
      </div>
    </div>
  );
}
