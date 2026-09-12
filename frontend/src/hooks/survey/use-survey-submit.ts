"use client";

import { useMutation } from "@tanstack/react-query";
import { getAnonymousId } from "@/lib/anonymous-id";
import { SURVEY_VERSION } from "@/constants/survey";
import type { SurveySubmission, SurveyTarget } from "@/types/survey";

/**
 * 설문 응답 전송 (S15P21A405-250).
 *
 * 목 라우트(`/bff/feedback`)로 보낸다. 백엔드가 준비되면 라우트 안만 바뀌고
 * 이 훅은 그대로다.
 *
 * `src/lib/api.ts` 의 공통 래퍼를 쓰지 않는다 — 그 래퍼는 `Authorization` 헤더를 붙이는데,
 * 1차 배포는 로그인 없이 들어오므로 설문은 인증 없이 보내야 한다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export function useSurveySubmit() {
  return useMutation({
    // 경과 시간은 여기서 잰다 — 컴포넌트 렌더 단계에서 Date.now() 를 부르면 순수하지 않다
    mutationFn: async (input: { target: SurveyTarget; answers: string[][]; openedAt: number }) => {
      const body: SurveySubmission = {
        ...input.target,
        answers: input.answers,
        anonymousId: getAnonymousId(),
        surveyVersion: SURVEY_VERSION,
        // 지금은 X 버튼 없이 제출을 강제한다. 자발적 응답과 구분해서 분석할 수 있게 남긴다
        forced: true,
        elapsedMs: Math.max(0, Date.now() - input.openedAt),
        answeredAt: new Date().toISOString(),
      };

      const res = await fetch("/bff/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`설문 전송 실패 (${res.status})`);
      return res.json();
    },
    // 응답을 못 보내도 사용자를 막지 않는다 — 설문은 부가 기능이다
    retry: 1,
  });
}
