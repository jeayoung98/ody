"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/constants";
import { flattenSearch, useMusicSearchQuery } from "@/hooks/queries/use-music-search-query";
import { useSearchAnalytics } from "@/hooks/use-search-analytics";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useUnplayableStore } from "@/stores/use-unplayable-store";
import type { MusicSearchResult, SearchCondition } from "@/types";

/**
 * 검색이 들고 있는 상태 (S15P21A405-399).
 *
 * `chip` 이 확정한 **첫 조건**이고 `input` 은 남은 입력이다. 둘 다 칩으로 굳히는 네 번째
 * 상태를 만들지 않는 이유는, 첫 조건만 고정해도 세 경로가 전부 표현되기 때문이다.
 */
export type Chip = { kind: "artist" | "music"; value: string } | null;

/**
 * 칩에 띄우는 조건 이름. **조건을 가리킬 때만 `제목`이다** — 결과를 가리키는 말은 `음악`
 * 그대로 둔다("일치하는 음악이 없습니다"). 둘은 다른 것을 가리키므로 같은 말로 묶지 않는다.
 */
export const CHIP_LABEL = { artist: "아티스트", music: "제목" } as const;

/** 상태 → 검색 조건. 화면 상태와 요청 조건을 가르는 자리는 여기 하나다 */
function conditionOf(chip: Chip, input: string): SearchCondition {
  if (!chip) return { mode: "all", query: input };
  if (chip.kind === "artist") return { mode: "artist", artist: chip.value, music: input };
  return { mode: "music", music: chip.value, artist: input };
}

/**
 * 검색 상태·질의·선택을 한 군데로 모은 훅 (S15P21A405-417).
 *
 * **떼어낸 이유는 자리가 둘이 됐기 때문이다.** 데스크톱은 지도 위에 떠 있는 알약이 펼쳐지며
 * 드롭다운으로 결과를 보여 주고, 좁은 화면은 `/search` **하위 페이지**로 넘어간다. 둘이 같은
 * 칩 규칙·디바운스·선택 동작을 써야 하는데, 복사해 두면 한쪽만 고쳐지는 날이 온다.
 *
 * 여는/접는 상태는 여기 두지 않았다 — 알약에만 있는 개념이고 페이지에는 없다.
 *
 * @param visible 결과가 실제로 화면에 보이는 중인지. 분석이 노출 시점을 이걸로 잰다
 * @param source  분석에 남길 출처 (`map_search` · `search_page` …)
 */
export function useMusicSearch({ visible, source }: { visible: boolean; source: string }) {
  const [input, setInput] = useState("");
  const [chip, setChip] = useState<Chip>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 한 글자마다 묻지 않는다 — 닉네임 검사와 같은 길이로 맞춘다 */
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const condition = conditionOf(chip, debounced);
  const query = useMusicSearchQuery(condition);
  /**
   * **못 트는 곡은 결과에서 뺀다** (S15P21A405-544). 지도에서 별을 지우는 것과 같은 이유다 —
   * 눌러도 아무 일이 없는 줄을 다시 찾아내지 않게 한다.
   *
   * 여기서 거르는 것은 **곡을 열어 보고 알게 된 것**뿐이다. 서버가 아는 재생 불가 곡은 검색
   * 응답에 아예 오지 않는다 (백엔드가 `video_id='none'` 을 제외한다).
   *
   * 거른 뒤의 수를 분석에 넘긴다 — 사용자가 본 것이 곧 결과 수다.
   */
  const unplayableIds = useUnplayableStore((s) => s.ids);
  const rawResults = flattenSearch(query.data?.pages);
  const results = useMemo(() => rawResults.filter((r) => !unplayableIds.has(r.id)), [rawResults, unplayableIds]);
  const analytics = useSearchAnalytics({
    keyword: chip ? `${chip.kind}:${chip.value} ${debounced}` : debounced,
    visible,
    pending: query.isPending,
    count: results.length,
    pages: query.data?.pages.length ?? 0,
    source,
  });
  const focusMusic = useMapStore((s) => s.focusMusic);
  const openSong = usePanelStore((s) => s.openSong);

  const reset = () => {
    setInput("");
    setDebounced("");
    setChip(null);
  };

  /**
   * 고른 곡을 지도에 띄우고 상세를 연다.
   * 이 겹에 있으면 확대해 가고, 없으면 고스트별로 띄운다 — 레이어를 자동으로 옮기지 않는다
   * (SEARCH-01, MAP-12).
   */
  const select = (r: MusicSearchResult) => {
    analytics.select(r.id, results.findIndex((item) => item.id === r.id) + 1);
    openSong(r.id);
    focusMusic(r.id);
  };

  /** 입력값을 조건으로 굳힌다. 남은 입력은 비우고 포커스는 유지해 다음 조건을 바로 받는다 */
  const promote = (kind: "artist" | "music") => {
    const value = input.trim();
    if (!value) return;
    setChip({ kind, value });
    setInput("");
    setDebounced("");
    inputRef.current?.focus();
  };

  /** 칩을 뗀다. 남은 입력은 통합 검색어로 그대로 살린다 (전달 문서 §2.1) */
  const removeChip = () => {
    setChip(null);
    inputRef.current?.focus();
  };

  return { input, setInput, chip, inputRef, condition, results, query, reset, select, promote, removeChip, analytics };
}
