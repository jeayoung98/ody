"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import { PlayIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { usePlayerStore } from "@/stores/use-player-store";
import { openYoutube } from "@/lib/youtube";
import type { MusicDetail } from "@/types";
import AddToPlaylistMenu from "../playlist/add-to-playlist-menu";

/** 재생 · 플리에 추가 · 여정 출발/도착으로 지정 */
export default function SongActions({ music }: { music: MusicDetail }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const playSingle = usePlayerStore((s) => s.playSingle);
  const recordPlay = useRecordPlayMutation();
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const openComposer = useOpenJourneyComposer();

  /** 사이트 안에서 들을 수 있는 곡인가 — 공식 플레이어 임베드가 붙는다 (규칙 6 D15) */
  const canEmbed = music.videoId != null;
  const canPlay = canEmbed || music.youtubeUrl != null;

  /**
   * `videoId` 가 있으면 **사이트 안에서** 듣는다 — 하단의 공식 플레이어가 스토어를 보고 재생한다.
   * 없으면 예전대로 유튜브 검색 결과를 새 탭으로 넘긴다 (규칙 6).
   * 어느 쪽이든 앱에는 "이 곡을 듣는 중" 상태가 남아 내 표식이 그 곡으로 이동한다 (MAP-08).
   */
  const handlePlay = () => {
    if (!canEmbed) openYoutube(music.youtubeUrl);
    playSingle(music.id);
    recordPlay.mutate({ musicId: music.id, source: "MAP", playedMs: 0 });
  };

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant={canPlay ? "primary" : "secondary"} className="flex-1" onClick={handlePlay} disabled={!canPlay}>
          <PlayIcon size={13} /> {canEmbed ? "재생" : canPlay ? "유튜브에서 듣기" : "재생 불가"}
        </Button>
        <Button onClick={() => setMenuOpen((v) => !v)} active={menuOpen}>
          ＋ 플리
        </Button>
      </div>
      {/* 지점을 넣고 곧바로 확장 검색창으로 넘어간다 — 나머지 한 지점을 거기서 고른다 (JOURNEY-01) */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            setStart(music.id);
            openComposer("end");
          }}
        >
          여정 출발점으로
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            setEnd(music.id);
            openComposer("start");
          }}
        >
          여정 도착점으로
        </Button>
      </div>
      {!canPlay && (
        <Note>
          이 곡은 음원 연결이 없습니다. 지도에는 계속 표시되지만 재생은 되지 않아요. <span className="text-ink-4">SONG-04</span>
        </Note>
      )}
      {canPlay && (
        <Note>
          음원은 앱 밖에서 듣습니다 — 누르면 <b>유튜브 검색 결과가 새 탭</b>으로 열려요. <span className="text-ink-4">SONG-03</span>
        </Note>
      )}
      {menuOpen && <AddToPlaylistMenu musicId={music.id} onDone={() => setMenuOpen(false)} />}
    </div>
  );
}
