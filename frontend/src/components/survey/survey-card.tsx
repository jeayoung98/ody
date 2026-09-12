"use client";

import { useState } from "react";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import { SURVEYS } from "@/constants/survey";
import { useSurveySubmit } from "@/hooks/survey/use-survey-submit";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveyOption, SurveyStep } from "@/types/survey";

/** 고른 선택지 — 테두리만으로는 안 보여서 배경까지 칠하고 글자를 밝게 올린다 */
const SELECTED_CLASS = "bg-violet/25! border-violet! text-white! shadow-glow-violet";

/** 골랐다는 표시. 색만으로 구분하지 않게 모양도 같이 바뀐다 */
function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 이 단계에서 보여줄 선택지 — 앞 단계 답에 따라 달라질 수 있다 */
function optionsOf(step: SurveyStep, prev: string | undefined): SurveyOption[] {
  if (step.options) return step.options;
  if (prev && step.optionsByPrev?.[prev]) return step.optionsByPrev[prev];
  return [];
}

/** 이 단계에서 보여줄 질문 */
function questionOf(step: SurveyStep, prev: string | undefined): string {
  return (prev && step.questionByPrev?.[prev]) || step.question;
}

/**
 * 설문 카드 (S15P21A405-250).
 *
 * **한 창에 다 보여준다.** 단계를 넘기면 화면이 갈아엎히고 답한 게 안 보여서 번거롭다.
 * 대신 **앞 단계를 답해야 다음 단계가 아래에 열린다** — 2단계 선택지가 1단계 답에
 * 따라 달라져서(비슷해요 → "어떤 점이 비슷했나요", 달라요 → "어떤 점이 어색했나요")
 * 처음부터 다 보여줄 수가 없다.
 *
 * **단계 개수를 모른다.** `constants/survey.ts` 의 `steps` 배열 길이가 곧 단계 수라,
 * 2단계가 4단계로 늘어도 이 파일은 그대로다 — 아래로 계속 쌓인다.
 *
 * 제출해야만 닫힌다 — X·바깥 클릭·ESC 로 닫히지 않는다. 테스터에게 응답을 강제하는 설계다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyCard() {
  const target = useSurveyStore((s) => s.target);
  const openedAt = useSurveyStore((s) => s.openedAt);
  const close = useSurveyStore((s) => s.close);
  const submit = useSurveySubmit();

  /** 단계별로 고른 값. 제출 전까지 여기에만 있다 — 스토어에 담을 이유가 없다 */
  const [state, setState] = useState<{ key: string; answers: string[][] }>({ key: "", answers: [] });

  // 대상이 바뀌면 답을 새로 시작한다 (effect 안 setState 대신 "adjusting state during render")
  const key = target ? `${target.kind}:${target.musicId}` : "";
  if (state.key !== key) setState({ key, answers: [] });

  if (!target) return null;
  const definition = SURVEYS[target.kind];
  if (!definition) return null;

  const answers = state.answers;

  /**
   * 이 단계의 답을 정한다.
   *
   * 지금 고른 것을 **updater 안에서** 읽는다 — 렌더 때 잡아둔 값으로 계산하면 같은 틱에
   * 두 번 누를 때 앞 선택이 덮여서 사라진다.
   */
  const setAnswer = (index: number, next: (current: string[]) => string[]) =>
    setState((s) => {
      const answers = [...s.answers];
      answers[index] = next(answers[index] ?? []);
      // 앞 단계를 고쳐 고르면 뒤 단계 답은 버린다 — 선택지 자체가 달라지기 때문이다
      return { ...s, answers: answers.slice(0, index + 1) };
    });

  /** 지금 열려 있는 단계들. 앞 단계를 답할수록 아래로 늘어난다 */
  const open: { index: number; step: SurveyStep; options: SurveyOption[]; question: string }[] = [];
  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    const options = optionsOf(step, answers[i - 1]?.[0]);
    if (options.length === 0) break;
    open.push({ index: i, step, options, question: questionOf(step, answers[i - 1]?.[0]) });

    const picked = answers[i];
    // 복수 선택은 하나도 안 골라도 넘어간다 — 고민을 강요하면 대충 찍게 된다
    if (step.multiple) continue;
    if (!picked?.length) break;
    // "잘 모르겠어요" 처럼 이유를 물을 필요가 없는 답이면 여기서 끝낸다
    if (options.find((o) => o.value === picked[0])?.terminal) break;
  }

  // 단일 선택 단계는 answers 가 비어 있으면 아직 덜 답한 것이다
  const canSubmit = open.every(({ index, step }) => step.multiple || (answers[index]?.length ?? 0) > 0);
  const hasMultiple = open.some(({ step }) => step.multiple);

  const finish = () => {
    submit.mutate({ target, answers: open.map(({ index }) => answers[index] ?? []), openedAt });
    close();
  };

  return (
    // 바깥 클릭으로 닫히지 않는다 — onClick 핸들러를 달지 않는 것이 그 구현이다
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-sm animate-tin" role="dialog" aria-modal="true" aria-label="설문">
        <Box title="잠깐만요">
          {open.map(({ index, step, options, question }) => (
            <div key={index} className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed text-ink">{question}</p>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => {
                  const on = answers[index]?.includes(o.value) ?? false;
                  return (
                    <Button
                      key={o.value}
                      size="sm"
                      aria-pressed={on}
                      // 공용 active 표시(테두리 발광)는 어두운 배경에서 눌렀는지가 잘 안 보인다.
                      // 설문은 응답 강제라 "골랐다"가 확실해야 해서 배경까지 칠한다
                      className={on ? SELECTED_CLASS : ""}
                      onClick={() =>
                        setAnswer(index, (current) =>
                          step.multiple ? (current.includes(o.value) ? current.filter((v) => v !== o.value) : [...current, o.value]) : [o.value],
                        )
                      }
                    >
                      {on && <CheckIcon />}
                      {o.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-ink-3">{hasMultiple ? "해당되는 것을 모두 고르세요" : ""}</span>
            <Button variant="primary" size="sm" disabled={!canSubmit} onClick={finish}>
              제출
            </Button>
          </div>
        </Box>
      </div>
    </div>
  );
}
