"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import { FlagIcon, PauseIcon, PlayIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import { PLAYBACK_BLOCKED } from "@/constants";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { usePlayability } from "@/hooks/queries/use-video-id-query";
import { useFeatures } from "@/hooks/use-features";
import { usePlaySong } from "@/hooks/use-play-song";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { MusicDetail } from "@/types";
import AddToPlaylistMenu from "../playlist/add-to-playlist-menu";
import SongReportDialog from "./song-report-dialog";

/** 재생 · 플리에 추가 · 여정 출발/도착으로 지정 */
export default function SongActions({ music }: { music: MusicDetail }) {
  const features = useFeatures();
  const [menuOpen, setMenuOpen] = useState(false);
  /** 신고 팝업이 떠 있나 (S15P21A405-378). 고르면 보내고 닫힌다 */
  const [reportOpen, setReportOpen] = useState(false);
  const playWithConfirm = usePlaySong();
  const pause = usePlayerStore((s) => s.pause);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const recordPlay = useRecordPlayMutation();
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const openComposer = useOpenJourneyComposer();
  const showToast = useToastStore((s) => s.show);

  /**
   * 들을 수 있는 곡인가 — 판단과 문구는 `usePlayability` 한 곳에서 온다 (S15P21A405-364).
   *
   * 예전에는 `videoId` 가 없으면 유튜브 검색 링크를 새 탭으로 열었다. 탭이 열리면 탐색 흐름이
   * 끊겨서 그 길을 걷어냈다. 이제 사이트 안에서 못 트는 곡은 `재생 불가` 다 (SONG-04).
   */
  const { canPlay, blocked, retry } = usePlayability(music.id);

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
     * 못 트는 곡이면 **왜 안 되는지 알려 준다** (S15P21A405-336). 예전에는 버튼이 꺼져 있어
     * 눌러도 아무 일도 안 났다 — 아래 안내문을 못 본 사람에게는 고장으로 보인다.
     */
    if (blocked) {
      showToast(blocked.notice);
      // 아직 안 찾아본 곡·조회 실패는 다시 부르면 채워질 수 있다 (S15P21A405-332)
      if (blocked.retryable) retry();
      return;
    }
    if (isThisPlaying) {
      pause();
      return;
    }
    // 순차 재생 중 목록 밖의 곡이면 먼저 물어본다 (S15P21A405-341)
    playWithConfirm(music.id, () => recordPlay.mutate({ musicId: music.id, source: "MAP", playedMs: 0 }));
  };

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant={canPlay ? "primary" : "secondary"} className="flex-1" onClick={handlePlay}>
          {isThisPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />} {isThisPlaying ? "정지" : blocked ? blocked.badge : "재생"}
        </Button>
        {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333). 설문 모드를 끄면 돌아온다 (387) */}
        {features.playlist && (
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
      {/*
        곡 신고 (S15P21A405-377 · 378). 처음에는 밑줄 친 작은 글씨로 뒀는데 **아무도 못 찾았다.**
        자주 쓸 것이 아니라고 본 판단은 맞았지만 약하게 둔 정도가 과했다. 아이콘을 붙여 버튼으로
        올리되, 재생·여정보다는 한 단계 낮은 무게로 둔다.
      */}
      <Button size="sm" className="self-start" onClick={() => setReportOpen(true)}>
        <FlagIcon size={12} /> 이 곡 신고
      </Button>
      {reportOpen && <SongReportDialog musicId={music.id} title={music.title} unplayable={blocked === PLAYBACK_BLOCKED.noVideo} onClose={() => setReportOpen(false)} />}
      {features.playlist && menuOpen && <AddToPlaylistMenu musicId={music.id} onDone={() => setMenuOpen(false)} />}
    </div>
  );
}
