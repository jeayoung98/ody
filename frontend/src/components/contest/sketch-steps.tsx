import { SKETCH_STEPS, type SketchStep } from "@/constants";

/**
 * 그리기 탭의 진행 단계 (S15P21A405-693). 지금 단계만 밝고, 지난 단계는 ✓, 남은 단계는 흐리다.
 * `current` 가 null 이면 모두 끝난 것이다 (채점까지 받은 내 작품을 보고 있다).
 */
export default function SketchSteps({ current }: { current: SketchStep | null }) {
  const at = current == null ? SKETCH_STEPS.length : SKETCH_STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="진행 단계">
      {SKETCH_STEPS.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={s.key} className="flex items-center gap-2" aria-current={now ? "step" : undefined}>
            {i > 0 && <span className="text-ink-4">›</span>}
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 ${
                now ? "border-teal/50 bg-teal/[.1] font-medium text-teal" : done ? "border-line text-ink-2" : "border-transparent text-ink-4"
              }`}
            >
              <span className="num text-xs">{done ? "✓" : i + 1}</span>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
