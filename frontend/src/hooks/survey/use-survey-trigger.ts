"use client";

import { useEffect, useRef } from "react";
import { SURVEY_FORCE_KEY, SURVEY_FORCE_PARAM, SURVEY_MIN_LISTEN_MS } from "@/constants/survey";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveyPrompt } from "@/types/survey";

/**
 * `?survey=force` 를 **모듈이 처음 불릴 때 한 번만** 읽는다.
 *
 * 화면에 들어온 직후 다른 코드가 `router.replace` 로 주소를 갈아치우면서 쿼리를 지운다.
 * 설문이 뜰 시점(곡을 고르고 한참 뒤)에 다시 읽으면 이미 없어서, 매번 읽으면 절대 안 걸린다.
 * 그래서 여기서 한 번 집어 세션에 남긴다. `?survey=off` 로 끈다.
 */
function readForced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get(SURVEY_FORCE_PARAM);
    if (q === "force") {
      sessionStorage.setItem(SURVEY_FORCE_KEY, "1");
      return true;
    }
    if (q === "off") {
      sessionStorage.removeItem(SURVEY_FORCE_KEY);
      return false;
    }
    return sessionStorage.getItem(SURVEY_FORCE_KEY) === "1";
  } catch {
    // 시크릿 모드 등 저장소가 막힌 환경 — 강제 없이 원래 조건대로 간다
    return false;
  }
}

export const SURVEY_FORCED = readForced();

/**
 * 언제 설문을 띄울지 판단한다 (S15P21A405-294).
 *
 * **20초 이상 들어야 묻는다.** 못 채우고 떠난 곡은 묻지 않고 무응답 행만 보낸다
 * (`survey-runner` 가 처리한다) — 스킵한 곡이 통계에서 통째로 빠지면 정밀도가 실제보다
 * 좋게 나오기 때문이다.
 *
 * ⚠️ **청취 시간은 아직 근사값이다.** 앱 안에서 실제 음원을 재생하지 않아(규칙 6)
 * "얼마나 들었는지"를 알 수 없어서, **그 곡이 현재 곡으로 머문 시간**으로 대신 잰다.
 * 자동재생(S15P21A405-258)이 붙으면 실제 재생 시간으로 바꾼다.
 *
 * 개발 중에는 `?survey=force` 로 즉시 띄운다 (`?survey=off` 로 해제).
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export function useSurveyTrigger(prompt: SurveyPrompt | null) {
  const open = useSurveyStore((s) => s.open);
  const hasSent = useSurveyStore((s) => s.hasSent);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!prompt) return;
    if (hasSent(prompt.target)) return;

    // TODO(자동재생): 실제 재생이 붙으면 이 지연을 "실제 청취 시간 >= SURVEY_MIN_LISTEN_MS" 로 바꾼다
    timer.current = setTimeout(() => open(prompt), SURVEY_FORCED ? 0 : SURVEY_MIN_LISTEN_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // target 은 객체라 매 렌더 새 참조일 수 있다 — 값으로 비교해 타이머가 리셋되지 않게 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt?.target.sessionId, prompt?.target.rank, prompt?.target.musicId, open, hasSent]);
}
