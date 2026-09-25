"use client";

import Button from "@/components/common/button";
import { PlayIcon } from "@/components/common/icons";
import Tag from "@/components/common/tag";
import { useLikePlaylistMutation } from "@/hooks/mutations/use-like-playlist-mutation";
import { formatDuration } from "@/lib/format";
import { usePlayPlaylist } from "@/hooks/use-play-playlist";
import type { PlaylistDetail } from "@/types";

/** 플리 제목 · 무드 태그 3개 · 곡 수 · 만든 사람 · 총 재생 시간 · 순차재생 · 좋아요 */
export default function PlaylistHeader({ playlist }: { playlist: PlaylistDetail }) {
  const like = useLikePlaylistMutation();
  // 별자리 뷰까지 함께 켠다 (S15P21A405-613) — 곡 목록의 `이 곡부터 재생` 과 같은 길이다
  const playPlaylist = usePlayPlaylist(playlist);

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
        <Button variant="primary" className="flex-1" onClick={() => playPlaylist()} disabled={playlist.items.length === 0}>
          <PlayIcon size={15} /> 순차 재생
        </Button>
        {/* 지금 상태의 **반대**를 목표로 보낸다 — 서버가 뒤집지 않는다 (S15P21A405-492) */}
        <Button active={playlist.isLiked} onClick={() => like.mutate({ playlistId: playlist.id, liked: !playlist.isLiked })} disabled={like.isPending}>
          {playlist.isLiked ? "♥" : "♡"} <span className="num">{playlist.likeCnt ?? 0}</span>
        </Button>
      </div>
    </div>
  );
}
