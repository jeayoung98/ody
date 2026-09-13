"use client";

import { useState } from "react";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import { SURVEYS } from "@/constants/survey";
import { useSurveySubmit } from "@/hooks/survey/use-survey-submit";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveyReason } from "@/types/survey";

/** 고른 것이 눌린 티가 나게 — 테두리 발광만으로는 어두운 배경에서 안 보인다 */
const SELECTED_CLASS = "bg-violet/25! border-violet! text-white! shadow-glow-violet";

/** 골랐다는 표시. 색만으로 구분하지 않게 모양도 같이 바뀐다 */
function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 설문 카드 (S15P21A405-294).
 *
 * 질문 하나에 답 둘. **부정일 때만** 이유를 한 번 더 묻는다 — 긍정 이유는 백엔드가
 * 아예 저장하지 않는다(`CHECK ((verdict = false) = (reason IS NOT NULL))`).
 *
 * 긍정은 **고르는 즉시 전송**한다. 더 물을 것이 없어서 확인 버튼을 거칠 이유가 없다.
 * 부정은 이유를 골라야 제출된다 — 이유 없는 부정은 서버가 거부한다.
 *
 * 제출해야만 닫힌다 — X·바깥 클릭·ESC 로 닫히지 않는다. 테스터에게 응답을 강제하는 설계다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyCard() {
  const target = useSurveyStore((s) => s.target);
  const listenedMs = useSurveyStore((s) => s.listenedMs);
  const close = useSurveyStore((s) => s.close);
  const markSent = useSurveyStore((s) => s.markSent);
  const submit = useSurveySubmit();

  /** `verdict` 가 false 면 이유를 고르는 중이다 */
  const [state, setState] = useState<{ key: string; verdict: boolean | null; reason: SurveyReason | null }>({
    key: "",
    verdict: null,
    reason: null,
  });

  // 대상이 바뀌면 답을 새로 시작한다 (effect 안 setState 대신 "adjusting state during render")
  const key = target ? `${target.sessionId}:${target.rank}` : "";
  if (state.key !== key) setState({ key, verdict: null, reason: null });

  if (!target) return null;
  const definition = SURVEYS[target.mode];

  const send = (verdict: boolean, reason: SurveyReason | null) => {
    submit.mutate({ target, verdict, reason, listenedMs: listenedMs[target.musicId] ?? 0, skipped: false });
    markSent(target);
    close();
  };

  const askingReason = state.verdict === false;

  return (
    // 바깥 클릭으로 닫히지 않는다 — onClick 핸들러를 달지 않는 것이 그 구현이다
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-sm animate-tin" role="dialog" aria-modal="true" aria-label="설문">
        <Box title="잠깐만요">
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-ink">{definition.question}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => send(true, null)}>
                {definition.yes}
              </Button>
              <Button
                size="sm"
                aria-pressed={askingReason}
                className={askingReason ? SELECTED_CLASS : ""}
                onClick={() => setState((s) => ({ ...s, verdict: false }))}
              >
                {askingReason && <CheckIcon />}
                아니요
              </Button>
            </div>
          </div>

          {askingReason && (
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed text-ink">{definition.reasonQuestion}</p>
              <div className="flex flex-wrap gap-2">
                {definition.reasons.map((r) => (
                  <Button
                    key={r.value}
                    size="sm"
                    aria-pressed={state.reason === r.value}
                    className={state.reason === r.value ? SELECTED_CLASS : ""}
                    onClick={() => setState((s) => ({ ...s, reason: r.value }))}
                  >
                    {state.reason === r.value && <CheckIcon />}
                    {r.label}
                  </Button>
                ))}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                {/* 이유 없는 부정은 서버가 거부한다 — 고르기 전에는 제출을 막는다 */}
                <span className="text-[10px] text-ink-3">이유를 하나 골라주세요</span>
                <Button variant="primary" size="sm" disabled={state.reason == null} onClick={() => send(false, state.reason)}>
                  제출
                </Button>
              </div>
            </div>
          )}
        </Box>
      </div>
    </div>
  );
}
