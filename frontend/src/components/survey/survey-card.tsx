"use client";

import { useEffect, useState } from "react";
import AlbumCover from "@/components/common/album-cover";
import Box from "@/components/common/box";
import Button from "@/components/common/button";
import { SURVEY_TARGET_LABEL, SURVEYS } from "@/constants/survey";
import { useSurveySubmit } from "@/hooks/survey/use-survey-submit";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveyReason, SurveySong } from "@/types/survey";

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
 * 카드에 곡 한 줄 — 커버 · 라벨 · 제목 · 가수.
 *
 * 라벨을 제목 위에 올린 이유는 폭이다. 왼쪽에 세우면 긴 제목·긴 가수명이 좁은 칸에서
 * 여러 줄로 접힌다. 위에 두면 커버 옆 폭을 다 쓴다.
 *
 * 제목은 **자르지 않는다.** 말줄임으로 끊으면 어느 곡인지 못 알아보는 경우가 생긴다.
 * 가수는 한 줄만 — 곡을 가리는 값이 아니라 거드는 값이다.
 */
function SurveySongRow({ label, song, highlight = false }: { label: string; song: SurveySong; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* `lbl` 유틸(9.5px 모노 대문자 + 자간)은 여기서 안 쓴다 — 한글이 읽히지 않는다 */}
      <span className={`text-[12.5px] leading-none font-semibold ${highlight ? "text-violet" : "text-ink-3"}`}>{label}</span>
      <div className="flex items-center gap-3">
        <AlbumCover coverUrl={song.coverUrl} genreId={song.genreId} alt="" size={highlight ? 46 : 38} />
        <div className="min-w-0 flex-1">
          <p
            className={
              highlight
                ? "font-display text-[18px] leading-tight font-semibold break-keep text-ink"
                : "text-[15px] leading-tight break-keep text-ink-2"
            }
          >
            {song.title}
          </p>
          <p className={`mt-1 truncate text-[13px] ${highlight ? "text-ink-2" : "text-ink-3"}`}>{song.artist ?? "Unknown"}</p>
        </div>
      </div>
    </div>
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
  const prompt = useSurveyStore((s) => s.prompt);
  const elapsedMs = useSurveyStore((s) => s.elapsedMs);
  const close = useSurveyStore((s) => s.close);
  const markSent = useSurveyStore((s) => s.markSent);
  const submit = useSurveySubmit();

  /** `verdict` 가 false 면 이유를 고르는 중이다 */
  const [state, setState] = useState<{ key: string; verdict: boolean | null; reason: SurveyReason | null }>({
    key: "",
    verdict: null,
    reason: null,
  });

  /**
   * 카드가 떠 있는 동안 자동 넘김을 막는다 (S15P21A405-258).
   *
   * 재생 코드를 직접 붙잡지 않는다 — 공용 플래그만 올린다. 설문을 통째로 지워도
   * 그 플래그는 늘 비어 있는 상태가 되어 재생이 원래대로 돈다.
   */
  const block = useBlockingStore((s) => s.block);
  const unblock = useBlockingStore((s) => s.unblock);
  useEffect(() => {
    if (!prompt) return;
    block("survey");
    return () => unblock("survey");
  }, [prompt, block, unblock]);

  // 대상이 바뀌면 답을 새로 시작한다 (effect 안 setState 대신 "adjusting state during render")
  const key = prompt ? `${prompt.target.sessionId}:${prompt.target.rank}` : "";
  if (state.key !== key) setState({ key, verdict: null, reason: null });

  if (!prompt) return null;
  const target = prompt.target;
  const definition = SURVEYS[target.mode];

  const send = (verdict: boolean, reason: SurveyReason | null) => {
    submit.mutate({ target, verdict, reason, listenedMs: elapsedMs(target.musicId), skipped: false, durationSec: prompt.subject.durationSec });
    markSent(target);
    close();
  };

  const askingReason = state.verdict === false;

  return (
    // 바깥 클릭으로 닫히지 않는다 — onClick 핸들러를 달지 않는 것이 그 구현이다
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-md animate-tin" role="dialog" aria-modal="true" aria-label="설문">
        <Box title="잠깐만요">
          {/*
            **두 곡을 같이 보여준다.** 한쪽만 있으면 그게 방금 들은 곡인지 비교 상대인지
            알 수 없다 — 실제로 그랬다. 이웃을 두어 번 건너가면 기준곡도 기억나지 않는데
            카드가 화면을 덮어서 지도로 확인할 수도 없다.

            문장에 끼워 넣지 않는 이유는 조사다 — 제목 받침에 따라 와/과 가 갈린다.
            아래가 평가 대상이라는 것은 보라색 라벨·굵기·크기로 가른다(색만으로 가르지 않는다).
          */}
          <div className="flex flex-col gap-2 rounded-box-xs border border-line bg-void-3/50 px-3 py-2.5">
            <SurveySongRow label={definition.compareLabel} song={prompt.compare} />
            <div className="h-px bg-line" />
            <SurveySongRow label={SURVEY_TARGET_LABEL} song={prompt.subject} highlight />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-base leading-relaxed font-medium text-ink">{definition.question}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="md" onClick={() => send(true, null)}>
                {definition.yes}
              </Button>
              <Button
                size="md"
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
              <p className="text-base leading-relaxed font-medium text-ink">{definition.reasonQuestion}</p>
              <div className="flex flex-wrap gap-2">
                {definition.reasons.map((r) => (
                  <Button
                    key={r.value}
                    size="md"
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
                <span className="text-[12.5px] text-ink-3">이유를 하나 골라주세요</span>
                <Button variant="primary" size="md" disabled={state.reason == null} onClick={() => send(false, state.reason)}>
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
