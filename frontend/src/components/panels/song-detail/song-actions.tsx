"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import { PauseIcon, PlayIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import { FEATURES, UNPLAYABLE_NOTICE } from "@/constants";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { MusicDetail } from "@/types";
import AddToPlaylistMenu from "../playlist/add-to-playlist-menu";

/** 재생 · 플리에 추가 · 여정 출발/도착으로 지정 */
export default function SongActions({ music }: { music: MusicDetail }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const playSingle = usePlayerStore((s) => s.playSingle);
  const pause = usePlayerStore((s) => s.pause);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const recordPlay = useRecordPlayMutation();
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const openComposer = useOpenJourneyComposer();
  const showToast = useToastStore((s) => s.show);

  /**
   * 들을 수 있는 곡인가 — **`videoId` 하나로 판단한다** (S15P21A405-326).
   *
   * 예전에는 `videoId` 가 없으면 유튜브 검색 링크를 새 탭으로 열었다. 탭이 열리면 탐색 흐름이
   * 끊겨서 그 길을 걷어냈다. 이제 사이트 안에서 못 트는 곡은 `재생 불가` 다 (SONG-04).
   */
  const canPlay = music.videoId != null;

  /** 지금 이 곡이 울리고 있나 — 버튼이 상태를 보여줘야 또 누르지 않는다 (S15P21A405-325) */
  const isThisPlaying = canPlay && currentMusicId === music.id && isPlaying;

  /**
   * **사이트 안에서** 듣는다 — 하단의 공식 플레이어가 스토어를 보고 재생한다.
   * 앱에는 "이 곡을 듣는 중" 상태가 남아 내 표식이 그 곡으로 이동한다 (MAP-08).
   *
   * 울리는 중에 다시 누르면 멈춘다 — 라벨이 `정지` 인데 눌러도 안 멈추면 고장으로 읽힌다.
   */
  const handlePlay = () => {
    /**
     * 음원이 없는 곡이면 **왜 안 되는지 알려 준다** (S15P21A405-336). 예전에는 버튼이 꺼져 있어
     * 눌러도 아무 일도 안 났다 — 아래 안내문을 못 본 사람에게는 고장으로 보인다.
     */
    if (!canPlay) {
      showToast(UNPLAYABLE_NOTICE);
      return;
    }
    if (isThisPlaying) {
      pause();
      return;
    }
    playSingle(music.id);
    recordPlay.mutate({ musicId: music.id, source: "MAP", playedMs: 0 });
  };

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant={canPlay ? "primary" : "secondary"} className="flex-1" onClick={handlePlay}>
          {isThisPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />} {isThisPlaying ? "정지" : canPlay ? "재생" : "재생 불가"}
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
      {!canPlay && (
        <Note>
          이 곡은 음원 연결이 없습니다. 지도에는 계속 표시되지만 재생은 되지 않아요. <span className="text-ink-4">SONG-04</span>
        </Note>
      )}
      {FEATURES.playlist && menuOpen && <AddToPlaylistMenu musicId={music.id} onDone={() => setMenuOpen(false)} />}
    </div>
  );
}
