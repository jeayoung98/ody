"use client";

import { useState, type ReactNode } from "react";
import { InfoIcon } from "@/components/common/icons";

/**
 * 소제목 옆에 붙는 ⓘ — 궁금한 사람만 열어 보는 한 문단 (S15P21A405-435).
 *
 * 설명이 늘 펼쳐져 있으면 **목록보다 설명이 먼저 읽힌다.** 그렇다고 지울 수도 없는 말들이라
 * (유사도가 무엇인지, 축이 무엇인지는 이번 유저 테스트가 묻는 것이다) 접어 둔다.
 *
 * 호버로 뜨고, 누르면 고정된다 — 터치에는 호버가 없다. 포커스를 잃으면 닫힌다.
 */
export default function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={pinned}
        onClick={() => setPinned((v) => !v)}
        onBlur={() => setPinned(false)}
        className={`grid h-[18px] w-[18px] place-items-center rounded-pill transition-colors duration-fast ${pinned ? "text-teal" : "text-ink-4 hover:text-ink-2"}`}
      >
        <InfoIcon size={16} />
      </button>
      <span
        role="tooltip"
        className={`glass pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 w-[230px] -translate-x-1/2 rounded-box-sm! px-3 py-2 text-[13.5px] leading-[1.55] font-normal text-ink-2 transition-opacity duration-fast ${
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
