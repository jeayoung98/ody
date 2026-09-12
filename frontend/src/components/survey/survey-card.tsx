"use client";

import { useMemo, useState } from "react";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import { SURVEYS } from "@/constants/survey";
import { useSurveySubmit } from "@/hooks/survey/use-survey-submit";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveyOption, SurveyStep } from "@/types/survey";

/**
 * 설문 카드 (S15P21A405-250).
 *
 * **단계 개수를 모른다.** `constants/survey.ts` 의 `steps` 배열 길이가 곧 단계 수라,
 * 2단계가 4단계로 늘어도 이 파일은 그대로다.
 *
 * 제출해야만 닫힌다 — X·바깥 클릭·ESC 로 닫히지 않는다. 테스터에게 응답을 강제하는 설계다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyCard() {
  const target = useSurveyStore((s) => s.target);
  const stepIndex = useSurveyStore((s) => s.stepIndex);
  const answers = useSurveyStore((s) => s.answers);
  const openedAt = useSurveyStore((s) => s.openedAt);
  const choose = useSurveyStore((s) => s.choose);
  const next = useSurveyStore((s) => s.next);
  const close = useSurveyStore((s) => s.close);
  const submit = useSurveySubmit();

  /** 복수 선택 단계에서 고르는 중인 값 */
  const [picked, setPicked] = useState<string[]>([]);

  const definition = target ? SURVEYS[target.kind] : null;
  const step: SurveyStep | undefined = definition?.steps[stepIndex];

  /** 앞 단계에서 무엇을 골랐나 — 선택지와 질문이 여기에 따라 달라진다 */
  const prev = answers[stepIndex - 1]?.[0];

  const options: SurveyOption[] = useMemo(() => {
    if (!step) return [];
    if (step.options) return step.options;
    if (prev && step.optionsByPrev?.[prev]) return step.optionsByPrev[prev];
    return [];
  }, [step, prev]);

  const question = (prev && step?.questionByPrev?.[prev]) || step?.question || "";

  if (!target || !definition || !step) return null;

  const isLast = stepIndex >= definition.steps.length - 1;

  const finish = (finalAnswers: string[][]) => {
    submit.mutate({ target, answers: finalAnswers, openedAt });
    setPicked([]);
    close();
  };

  /** 단일 선택 — 고르는 즉시 다음 단계로. 확인 버튼을 거치지 않는다 */
  const pickSingle = (option: SurveyOption) => {
    choose([option.value]);
    const merged = [...answers];
    merged[stepIndex] = [option.value];

    // "잘 모르겠어요" 처럼 이유를 물을 필요가 없는 응답은 여기서 끝낸다
    if (option.terminal || isLast) finish(merged);
    else next();
  };

  /** 복수 선택 — 토글만 하고, 제출 버튼을 눌러야 넘어간다 */
  const toggle = (value: string) =>
    setPicked((cur) => (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));

  const submitMultiple = () => {
    choose(picked);
    const merged = [...answers];
    merged[stepIndex] = picked;
    if (isLast) finish(merged);
    else {
      setPicked([]);
      next();
    }
  };

  return (
    // 바깥 클릭으로 닫히지 않는다 — onClick 핸들러를 달지 않는 것이 그 구현이다
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-sm animate-tin" role="dialog" aria-modal="true" aria-label="설문">
        <Box title="잠깐만요" code={`${stepIndex + 1}/${definition.steps.length}`}>
          <p className="text-sm leading-relaxed text-ink">{question}</p>

          <div className="mt-1 flex flex-wrap gap-2">
            {options.map((o) =>
              step.multiple ? (
                <Button key={o.value} size="sm" active={picked.includes(o.value)} onClick={() => toggle(o.value)}>
                  {o.label}
                </Button>
              ) : (
                <Button key={o.value} size="sm" onClick={() => pickSingle(o)}>
                  {o.label}
                </Button>
              ),
            )}
          </div>

          {step.multiple && (
            <div className="mt-1 flex items-center justify-between gap-2">
              {/* 하나도 안 골라도 제출된다 — 고민을 강요하면 대충 찍게 된다 */}
              <span className="text-[10px] text-ink-3">해당되는 것을 모두 고르세요</span>
              <Button variant="primary" size="sm" onClick={submitMultiple}>
                제출
              </Button>
            </div>
          )}
        </Box>
      </div>
    </div>
  );
}
