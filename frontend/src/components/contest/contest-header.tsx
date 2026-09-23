import Tag from "@/components/common/tag";
import type { Contest } from "@/types";

const STATUS_LABEL = { OPEN: "접수·투표 중", CLOSED: "심사 중", ANNOUNCED: "발표" } as const;

const md = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 회차 머리 — 상태 · 회차 · 테마 · 기간. D-day 는 두지 않는다 (기획 확인, 2026-09-23) */
export default function ContestHeader({ contest }: { contest: Contest }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Tag tone={contest.status === "OPEN" ? "teal" : "default"}>{STATUS_LABEL[contest.status]}</Tag>
          <span className="lbl">{contest.roundNo}회차</span>
        </div>
        <h3 className="font-display text-[22px] leading-tight font-semibold">
          이번 테마는 <span className="grad-text">{contest.theme}</span>
        </h3>
      </div>
      <p className="text-xs text-ink-3">
        {md(contest.startsAt)} ~ {md(contest.endsAt)} · 발표 {md(contest.announceAt)}
      </p>
    </div>
  );
}
