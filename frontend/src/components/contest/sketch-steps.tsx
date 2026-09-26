import { SKETCH_STEPS, type SketchStep } from "@/constants";

/**
 * 그리기 탭 왼쪽의 세로 진행 바 (S15P21A405-693 · 702). 지금 단계만 밝고, 지난 단계는 ✓, 남은 단계는 흐리다.
 * 단계 사이를 선으로 이어 "어디까지 왔나" 가 한눈에 읽히게 한다. `current` 가 null 이면 모두 끝난 것이다.
 */
export default function SketchSteps({ current }: { current: SketchStep | null }) {
  const at = current == null ? SKETCH_STEPS.length : SKETCH_STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-col" aria-label="진행 단계">
      {SKETCH_STEPS.map((s, i) => {
        const done = i < at;
        const now = i === at;
        const last = i === SKETCH_STEPS.length - 1;
        return (
          <li key={s.key} className="flex gap-2.5" aria-current={now ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  now ? "border-teal bg-teal/[.14] text-teal" : done ? "border-teal/50 text-teal" : "border-line-2 text-ink-4"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {!last && <span className={`my-1 w-px flex-1 min-h-6 ${done ? "bg-teal/50" : "bg-line"}`} />}
            </div>
            <span className={`pt-0.5 pb-5 text-sm ${now ? "font-medium text-ink" : done ? "text-ink-2" : "text-ink-4"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
