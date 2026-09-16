"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import { PauseIcon, PlayIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import { FEATURES } from "@/constants";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useSongPlayToggle } from "@/hooks/use-song-play-toggle";
import { useJourneyStore } from "@/stores/use-journey-store";
import type { MusicDetail } from "@/types";
import AddToPlaylistMenu from "../playlist/add-to-playlist-menu";

/** 재생 · 플리에 추가 · 여정 출발/도착으로 지정 */
export default function SongActions({ music }: { music: MusicDetail }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const openComposer = useOpenJourneyComposer();

  // 제목 줄 옆 버튼과 같은 판단을 쓴다 (`use-song-play-toggle`)
  const { canPlay, blocked, isThisPlaying, toggle } = useSongPlayToggle(music.id);

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant={canPlay ? "primary" : "secondary"} className="flex-1" onClick={toggle}>
          {isThisPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />} {isThisPlaying ? "정지" : blocked ? blocked.badge : "재생"}
        </Button>
        {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333) */}
        {FEATURES.playlist && (
          <Button onClick={() => setMenuOpen((v) => !v)} active={menuOpen}>
            ＋ 플리
          </Button>
        )}
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
      {blocked && (
        <Note>
          {blocked.detail} {blocked.ref && <span className="text-ink-4">{blocked.ref}</span>}
        </Note>
      )}
      {FEATURES.playlist && menuOpen && <AddToPlaylistMenu musicId={music.id} onDone={() => setMenuOpen(false)} />}
    </div>
  );
}
