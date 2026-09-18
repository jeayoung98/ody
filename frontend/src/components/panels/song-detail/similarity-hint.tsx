"use client";

import { useState } from "react";
import { InfoIcon } from "@/components/common/icons";

/**
 * "이 곡과 가장 비슷해요!" 옆의 ⓘ — 누르면 유사도가 무엇인지 툴팁으로 말한다 (S15P21A405-435).
 *
 * 문장이 늘 펼쳐져 있으면 목록보다 설명이 먼저 읽혔다. 유사도 기준은 이번 유저 테스트가 묻는
 * 것이라 지우지는 않고, 궁금한 사람만 열어 보게 한다. 호버로도 뜨고, 누르면 고정된다 —
 * 터치에서는 호버가 없다. 포커스를 잃으면 닫힌다.
 */
export default function SimilarityHint() {
  const [pinned, setPinned] = useState(false);
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="유사도 설명"
        aria-expanded={pinned}
        onClick={() => setPinned((v) => !v)}
        onBlur={() => setPinned(false)}
        className={`grid h-[18px] w-[18px] place-items-center rounded-pill transition-colors duration-fast ${pinned ? "text-teal" : "text-ink-4 hover:text-ink-2"}`}
      >
        <InfoIcon size={14} />
      </button>
      <span
        role="tooltip"
        className={`glass pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 w-[230px] -translate-x-1/2 rounded-box-sm! px-3 py-2 text-[11.5px] leading-[1.55] font-normal text-ink-2 transition-opacity duration-fast ${
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <b className="font-medium text-ink">유사도</b>는 소리를 16차원으로 압축한 좌표에서 잰 거리예요. 가까울수록 소리가 닮았다는 뜻이에요.
      </span>
    </span>
  );
}
