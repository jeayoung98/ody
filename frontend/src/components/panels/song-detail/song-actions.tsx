"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import { ArriveIcon, DepartIcon } from "@/components/common/icons";
import Note from "@/components/common/note";
import { FEATURES } from "@/constants";
import { usePlayability } from "@/hooks/queries/use-video-id-query";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import type { MusicDetail } from "@/types";
import AddToPlaylistMenu from "../playlist/add-to-playlist-menu";

/**
 * 플리에 추가 · 여정 출발/도착으로 지정.
 *
 * **재생 버튼은 여기 없다** (S15P21A405-384). 제목 줄 옆의 동그란 버튼 하나로 합쳤다 —
 * 같은 동작이 한 화면에 두 번 있을 이유가 없다. 못 트는 곡 안내(`Note`)는 여기 남는다.
 */
export default function SongActions({ music }: { music: MusicDetail }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const setStart = useJourneyStore((s) => s.setStart);
  const setEnd = useJourneyStore((s) => s.setEnd);
  const openComposer = useOpenJourneyComposer();
  /** 왜 못 트는지 (SONG-04) — 판단은 `usePlayability` 한 곳에서 온다 */
  const { blocked } = usePlayability(music.id);

  return (
    <div className="relative flex flex-col gap-2">
      {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333) */}
      {FEATURES.playlist && (
        <Button className="self-start" onClick={() => setMenuOpen((v) => !v)} active={menuOpen}>
          ＋ 플리
        </Button>
      )}
      {/*
        지점을 넣고 곧바로 확장 검색창으로 넘어간다 — 나머지 한 지점을 거기서 고른다 (JOURNEY-01).
        아이콘 색은 여정 패널과 같다 (`journey-endpoints.tsx`): 출발 teal · 도착 violet.
      */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 text-2xs"
          onClick={() => {
            setStart(music.id);
            openComposer("end");
          }}
        >
          <DepartIcon className="text-teal" /> 여정 출발점으로
        </Button>
        <Button
          size="sm"
          className="flex-1 text-2xs"
          onClick={() => {
            setEnd(music.id);
            openComposer("start");
          }}
        >
          <ArriveIcon className="text-violet" /> 여정 도착점으로
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
