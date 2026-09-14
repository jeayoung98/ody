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

/** 강제 모드에서는 청취 시간을 안 본다 — 후보 중 가장 가까운 것을 그냥 쓴다 */
const RESOLVE_MIN_MS = SURVEY_FORCED ? 0 : SURVEY_MIN_LISTEN_MS;

/**
 * 언제 설문을 띄울지 판단한다 (S15P21A405-294).
 *
 * **두 곡을 다 20초 이상 들었을 때만 묻는다.** 평가 대상만이 아니라 **비교 상대도** 그렇다 —
 * 주변 탐색은 기준곡, 경로 탐색은 앞 곡이다. 2초 듣고 지나친 곡을 기준으로 "비슷했나요" 를
 * 물으면 답이 기억이 아니라 짐작이 된다.
 *
 * 못 채우고 떠난 곡은 묻지 않고 무응답 행만 보낸다 (`survey-runner` 가 처리한다) —
 * 스킵한 곡이 통계에서 통째로 빠지면 정밀도가 실제보다 좋게 나오기 때문이다.
 *
 * **20초는 실제로 재생된 시간이다.** 규칙 6 이 개정돼 공식 플레이어 임베드가 허용되고
 * (S15P21A405-290) `videoId` 가 채워지면서, 유튜브에서 멈추면 `isPlaying` 이 따라 내려온다.
 * 그래서 멈춰 있는 동안은 타이머를 안 걸고, 다시 틀면 **남은 만큼만** 건다.
 *
 * `videoId` 가 없는 곡은 임베드가 안 붙어 `isPlaying` 이 안 바뀐다 — 그때는 예전처럼
 * "현재 곡으로 머문 시간" 으로 수렴한다.
 *
 * 개발 중에는 `?survey=force` 로 즉시 띄운다 (`?survey=off` 로 해제).
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export function useSurveyTrigger(prompt: SurveyPrompt | null, playing: boolean) {
  const open = useSurveyStore((s) => s.open);
  const hasSent = useSurveyStore((s) => s.hasSent);
  const resolve = useSurveyStore((s) => s.resolve);
  const stintMs = useSurveyStore((s) => s.stintMs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!prompt) return;
    if (hasSent(prompt.target)) return;

    /**
     * 비교 상대를 얼마나 들었는지는 **이미 지나간 값이라 더 늘지 않는다** — 지금 재생 중인 곡은
     * 평가 대상 하나뿐이다. 그래서 여기서 한 번 정하고, 하나도 못 채웠으면 타이머를 안 건다.
     */
    const resolved = resolve(prompt, RESOLVE_MIN_MS);
    if (!resolved) return;

    if (SURVEY_FORCED) {
      timer.current = setTimeout(() => open(resolved), 0);
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    }

    /**
     * **재생된 시간으로 20초를 센다.** 멈춰 있으면 타이머를 아예 안 건다 — 그동안은 시계가
     * 안 돌기 때문이다. 다시 틀면 이 effect 가 다시 돌면서 **남은 만큼만** 건다.
     */
    if (!playing) return;
    const remaining = Math.max(0, SURVEY_MIN_LISTEN_MS - stintMs(prompt.target.musicId));
    timer.current = setTimeout(() => open(resolved), remaining);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // target 은 객체라 매 렌더 새 참조일 수 있다 — 값으로 비교해 타이머가 리셋되지 않게 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt?.target.sessionId, prompt?.target.rank, prompt?.target.musicId, playing, open, hasSent, resolve, stintMs]);
}
