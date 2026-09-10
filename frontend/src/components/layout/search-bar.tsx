"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/common/icons";
import { useMusicSearchQuery } from "@/hooks/queries/use-music-search-query";
import { GHOST_PROBE_KEYWORD } from "@/mocks/music";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import type { MusicSearchResult } from "@/types";
import SearchResultList from "./search-result-list";

/** #searchWrap — 상단 중앙 글래스 검색. 결과 클릭 시 지도상 위치로 이동 (SEARCH-01) */
export default function SearchBar() {
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isPending } = useMusicSearchQuery(keyword);
  const focusMusic = useMapStore((s) => s.focusMusic);
  const showGhost = useMapStore((s) => s.showGhost);
  const openSong = usePanelStore((s) => s.openSong);

  // 확인용 경로: "고스트별" 로 검색하면 이 겹에 있는 곡이어도 고스트별 디자인으로 띄운다.
  // 실제 규칙은 그 겹에 없는 곡일 때만 고스트 처리다 (MAP-12).
  const ghostProbe = keyword.trim().startsWith(GHOST_PROBE_KEYWORD);

  const handleSelect = (r: MusicSearchResult) => {
    setOpen(false);
    setKeyword("");
    openSong(r.id);
    if (ghostProbe) {
      showGhost(r.id);
      return;
    }
    // 이 겹에 있으면 확대해 가고, 없으면 고스트별로 띄운다 — 레이어를 자동으로 옮기지 않는다 (SEARCH-01, MAP-12)
    focusMusic(r.id);
  };

  return (
    <div className="absolute top-4 left-1/2 z-[22] w-[min(380px,32vw)] -translate-x-1/2">
      <div className="glass flex items-center gap-[9px] rounded-pill! px-[13px] py-[9px]">
        <SearchIcon className="shrink-0 opacity-50" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          placeholder="곡명 · 아티스트 검색"
          autoComplete="off"
          spellCheck={false}
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && (setKeyword(""), setOpen(false))}
        />
        <span className="lbl">search</span>
      </div>
      {open && keyword.trim() && <SearchResultList results={data ?? []} isLoading={isPending} onSelect={handleSelect} />}
    </div>
  );
}
