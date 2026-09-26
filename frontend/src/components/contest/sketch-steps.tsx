import { SKETCH_STEPS, type SketchStep } from "@/constants";

/**
 * 그리기 탭 왼쪽의 세로 진행 바 (S15P21A405-693 · 702).
 *
 * - 지금 단계: 동그라미만 민트로 채운다. 이름은 바탕 없이 민트 글씨
 * - 지나온 단계: 짙은 회색 ✓ 와 회색 이름. 민트는 "지금" 하나에만 쓴다 — 지나온 것까지 민트면 어디 있는지 흐려진다
 * - 남은 단계: 번호만 흐리게
 *
 * 동그라미와 잇는 선 사이에 틈을 두지 않는다 — 떠 있으면 한 줄로 이어진 흐름이 아니라 점 여러 개로 읽힌다.
 */
export default function SketchSteps({ current }: { current: SketchStep }) {
  const at = SKETCH_STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-col" aria-label="진행 단계">
      {SKETCH_STEPS.map((s, i) => {
        const done = i < at;
        const now = i === at;
        const last = i === SKETCH_STEPS.length - 1;
        return (
          <li key={s.key} className="flex gap-2" aria-current={now ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={`num flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px] leading-none font-semibold ${
                  now ? "border-teal bg-teal text-void" : done ? "border-line-2 bg-white/[.08] text-ink-4" : "border-line-2 text-ink-4"
                }`}
              >
                {now || done ? "✓" : i + 1}
              </span>
              {!last && <span className="min-h-6 w-px flex-1 bg-line-2" />}
            </div>
            <span className={`mb-4 text-[13px] leading-[18px] ${now ? "font-medium text-teal" : done ? "text-ink-3" : "text-ink-4"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
