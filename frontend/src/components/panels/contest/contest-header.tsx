"use client";

import { useState } from "react";
import Tag from "@/components/common/tag";
import type { Contest } from "@/types";

const STATUS_LABEL = { OPEN: "접수·투표 중", CLOSED: "심사 중", ANNOUNCED: "발표" } as const;

const md = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 회차 머리 — 상태 · 회차 · 테마 · 기간 · D-day */
export default function ContestHeader({ contest }: { contest: Contest }) {
  // 렌더 중 `Date.now()` 는 순수하지 않다(react-hooks/purity) — 마운트 시각으로 고정. 하루 단위라 충분하다
  const [now] = useState(() => Date.now());
  const dday = Math.ceil((new Date(contest.endsAt).getTime() - now) / 86_400_000);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Tag tone={contest.status === "OPEN" ? "teal" : "default"}>{STATUS_LABEL[contest.status]}</Tag>
        <span className="lbl">{contest.roundNo}회차</span>
        {contest.status === "OPEN" && <span className="num ml-auto text-xs text-ink-2">{dday > 0 ? `D-${dday}` : "오늘 마감"}</span>}
      </div>
      <h3 className="font-display text-[17px] font-semibold">
        이번 테마는 <span className="grad-text">{contest.theme}</span>
      </h3>
      <p className="text-xs text-ink-3">
        {md(contest.startsAt)} ~ {md(contest.endsAt)} · 발표 {md(contest.announceAt)}
      </p>
    </div>
  );
}
