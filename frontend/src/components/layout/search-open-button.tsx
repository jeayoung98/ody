"use client";

import { SearchIcon } from "@/components/common/icons";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 우측 패널이 열려 있는 동안 검색창 자리를 지키는 작은 버튼.
 * 검색창과 사이드 패널은 동시에 뜨지 않는다 — 누르면 패널이 닫히고 검색창이 돌아온다.
 */
export default function SearchOpenButton() {
  const close = usePanelStore((s) => s.close);

  return (
    <button
      type="button"
      onClick={close}
      title="검색 열기 (패널이 닫힙니다)"
      aria-label="검색 열기"
      className="glass absolute top-4 left-1/2 z-[22] flex -translate-x-1/2 items-center gap-[7px] rounded-pill! px-[13px] py-[9px] text-ink-2 transition-colors duration-fast hover:border-line-2 hover:text-ink"
    >
      <SearchIcon className="opacity-60" />
      <span className="lbl">search</span>
    </button>
  );
}
