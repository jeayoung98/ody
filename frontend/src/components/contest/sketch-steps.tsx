import { SKETCH_STEPS, type SketchStep } from "@/constants";

/**
 * 그리기 탭 왼쪽의 세로 진행 바 (S15P21A405-693 · 702).
 *
 * - 지금 단계: 동그라미를 민트로 채우고 흰 ✓, 이름도 민트 바탕에 흰 글씨 — 화면에서 가장 먼저 눈에 들어와야 한다
 * - 지나온 단계: 회색 ✓ 와 회색 이름. 민트는 "지금" 하나에만 쓴다 — 지나온 것까지 민트면 어디 있는지 흐려진다
 * - 남은 단계: 번호만 흐리게
 *
 * 동그라미와 잇는 선 사이에 틈을 두지 않는다 — 떠 있으면 한 줄로 이어진 흐름이 아니라 점 네 개로 읽힌다.
 * `current` 가 null 이면 모두 끝난 것이다(채점까지 받은 내 작품).
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
                className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] leading-none ${
                  now ? "border-teal bg-teal text-white" : done ? "border-line-2 bg-white/[.06] text-ink-3" : "border-line-2 text-ink-4"
                }`}
              >
                {now || done ? "✓" : i + 1}
              </span>
              {!last && <span className="min-h-7 w-px flex-1 bg-line-2" />}
            </div>
            <span
              className={`mb-5 self-start rounded-pill px-2 py-0.5 text-sm ${now ? "bg-teal font-medium text-white" : done ? "text-ink-3" : "text-ink-4"}`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
