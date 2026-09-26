import type { ReactNode } from "react";
import Note from "@/components/common/note";
import { roundPhase } from "@/lib/contest-view";
import type { Contest, ContestEntry } from "@/types";
import MyArtworkCard from "./my-artwork-card";

interface MyWorkViewProps {
  entry: ContestEntry;
  contest: Contest;
  /** 카드 바로 밑에 카드 폭에 맞춰 붙는 안내 (채점 중·채점 끝) (S15P21A405-702) */
  note?: ReactNode;
}

/**
 * 이미 낸 작품이 있을 때 그리기 탭의 채점 단계 (S15P21A405-693 · 702).
 *
 * 카드와 그 밑 안내만 둔다. AI 한 줄 평과 "새로 그리기" 는 다른 단계의 설명·다음 버튼과 같은 자리(판 아래 버튼 줄)에
 * 선다(702) — 단계마다 다음 동작이 같은 자리에 있어야 손이 헤매지 않는다 (`DrawNewButton`).
 */
export default function MyWorkView({ entry, contest, note }: MyWorkViewProps) {
  const open = roundPhase(contest) === "OPEN";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <MyArtworkCard entry={entry} theme={contest.theme} showComment={false} />
      {note && <p className="px-1 text-sm leading-relaxed text-ink-2">{note}</p>}
      {!open && <Note>지금은 접수 기간이 아니라 새로 낼 수 없어요.</Note>}
    </div>
  );
}
