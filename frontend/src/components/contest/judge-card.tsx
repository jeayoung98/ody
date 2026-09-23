import SectionTitle from "@/components/common/section-title";
import Skeleton from "@/components/common/skeleton";
import type { ContestJudge } from "@/types";

interface JudgeCardProps {
  judge: ContestJudge | null;
  pending: boolean;
  /** 이 점수 미만은 순위에서 빠진다 */
  aiGate: number;
  theme: string;
}

/**
 * AI 심사 결과 — 매칭이 끝나면 **바로** 보여준다 (즉시 심사). 이 점수 그대로 출품된다.
 * 점수는 모양만 본 것이라 곡 정보와 무관하다 (S15P21A405-548).
 */
export default function JudgeCard({ judge, pending, aiGate, theme }: JudgeCardProps) {
  const low = judge != null && judge.score < aiGate;
  return (
    <div className="flex flex-col gap-2 rounded-box-sm border border-line bg-white/[.03] px-3 py-2.5">
      <SectionTitle aside={pending ? "심사 중" : judge ? `${theme} 닮음` : null}>AI 심사 · 즉시</SectionTitle>
      {!judge && (
        <div className="flex flex-col gap-2 py-1">
          <Skeleton w={72} h={30} rounded="box" />
          <Skeleton w="88%" h={11} />
          <Skeleton w="61%" h={11} />
          <p className="text-xs text-ink-3">{pending ? "모양을 살펴보는 중..." : "심사를 기다리는 중..."}</p>
        </div>
      )}
      {judge && (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={`num text-[38px] leading-none font-semibold ${low ? "text-ink-3" : "grad-text"}`}>{judge.score}</span>
            <span className="lbl">/ 100</span>
          </div>
          <span className="h-1 overflow-hidden rounded-pill bg-white/[.08]">
            <i className={`block h-full rounded-pill ${low ? "bg-ink-4" : "grad-bg"}`} style={{ width: `${Math.max(3, judge.score)}%` }} />
          </span>
          <p className="text-sm leading-relaxed">{judge.comment}</p>
          <p className={`text-xs ${low ? "text-bad" : "text-teal"}`}>
            {low ? `${aiGate}점 미만 · 출품은 되지만 순위에서 빠져요` : `${aiGate}점 이상 · 순위 대상이에요`}
          </p>
        </>
      )}
    </div>
  );
}
