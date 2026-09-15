"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAnonymousId } from "@/lib/anonymous-id";
import { useSurveyStore } from "@/stores/use-survey-store";
import { questionKey, type AnsweredRow, type SurveyReason, type SurveySubmission, type SurveyTarget } from "@/types/survey";

/**
 * 우리 Next 서버의 통로. 그 안에서 백엔드 `POST /api/feedback` 을 대신 부른다.
 *
 * **브라우저가 백엔드를 직접 부르면 403 이다.** 배포 백엔드가 `Origin` 이 붙은 요청을 전부
 * `Invalid CORS request` 로 막는다 (BACKEND-NOTES B-17). 브라우저 요청에는 `Origin` 이 늘
 * 붙으므로 rewrite 로 흘려보내도 막힌다. 서버가 대신 부르면 그 헤더가 없다.
 */
const FEEDBACK_PATH = "/bff/feedback";
const ANSWERED_PATH = "/bff/feedback/answered";

interface SubmitInput {
  target: SurveyTarget;
  verdict: boolean | null;
  reason: SurveyReason | null;
  listenedMs: number;
  skipped: boolean;
  /** 곡 길이(초). 청취 시간의 상한 — 없으면 서버 상한만 건다 */
  durationSec?: number | null;
}

/**
 * 서버 `listened_sec` 은 `smallint` 이고 백엔드가 `@Max(32767)` 로 막는다.
 * 넘기면 400 이라 행이 통째로 버려진다.
 */
const LISTENED_SEC_MAX = 32767;

/**
 * 실제로 들었을 수 있는 최대치로 자른다.
 *
 * 시계는 **재생된 시간**을 재므로(S15P21A405-308 임베드 이후) 곡이 끝나면 그 자리에서 멈춘다.
 * 곡 길이를 아는 경우(경로 탐색) 거기서 자르고, 모르면 서버 상한에만 맞춘다.
 */
function clampListened(ms: number, durationSec?: number | null): number {
  const sec = Math.max(0, Math.round(ms / 1000));
  const cap = durationSec != null && durationSec > 0 ? Math.min(durationSec, LISTENED_SEC_MAX) : LISTENED_SEC_MAX;
  return Math.min(sec, cap);
}

/**
 * 설문 응답 한 건을 만든다 (S15P21A405-294).
 *
 * `verdict` 와 `reason` 의 관계를 DB 가 강제하므로 여기서 맞춰서 보낸다 —
 * 부정이면 이유가 반드시 있고, 긍정·무응답이면 이유가 없어야 한다.
 */
function buildRow(input: SubmitInput): SurveySubmission {
  return {
    ...input.target,
    anonymousId: getAnonymousId(),
    verdict: input.verdict,
    reason: input.verdict === false ? input.reason : null,
    listenedSec: clampListened(input.listenedMs, input.durationSec),
    skipped: input.skipped,
  };
}

/**
 * 사용자가 답한 응답을 보낸다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export function useSurveySubmit() {
  return useMutation({
    mutationFn: async (input: SubmitInput) => {
      const res = await fetch(FEEDBACK_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRow(input)),
      });
      if (!res.ok) throw new Error(`설문 전송 실패 (${res.status})`);
      return res.json();
    },
    // 응답을 못 보내도 사용자를 막지 않는다 — 설문은 부가 기능이다
    retry: 1,
  });
}

/**
 * 이미 답한 문항을 받아 스토어에 싣는다 (S15P21A405-346).
 *
 * **왜 필요한가**: 서버가 같은 사람 × 같은 문항을 한 번만 저장한다. 프론트가 그걸 모르면
 * 방금 답한 것을 또 묻고 서버는 저장하지 않고 조용히 버린다 — 사용자에게는 같은 질문이
 * 두 번 뜨는 고장으로 보인다.
 *
 * **실패를 삼킨다.** S15P21A405-346 이 아직 머지 전이라 이 경로가 404 일 수 있다. 그때는
 * 이번 탭에서 답한 것만 기억하는 상태로 떨어질 뿐, 설문 자체는 그대로 돈다.
 */
export function useLoadAnswered() {
  const loadAnswered = useSurveyStore((s) => s.loadAnswered);
  const { data } = useQuery({
    queryKey: ["survey", "answered"],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch(`${ANSWERED_PATH}?anonymousId=${encodeURIComponent(getAnonymousId())}`);
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: AnsweredRow[] };
      return (body.data ?? []).map(questionKey);
    },
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data?.length) loadAnswered(data);
  }, [data, loadAnswered]);
}

/**
 * 묻지 않고 행만 남긴다 — 답 없이 페이지를 떠난 곡 (`verdict = null`).
 *
 * 청취 시간 조건이 사라진 뒤로 이 길은 **탭을 닫거나 새로고침할 때 하나뿐이다**
 * (S15P21A405-335 결정 5). 카드가 떠 있든 아직 안 떴든, 밟은 간선이 남아 있으면 보낸다 —
 * 안 보내면 "밟았는데 답을 못 받은 간선" 이 통계에서 통째로 사라져 정밀도가 실제보다 좋아진다.
 *
 * **`sendBeacon` 을 쓰는 이유**: 탭을 닫거나 새로고침하는 순간 일반 `fetch` 는 취소된다.
 * 떠나는 시점이야말로 이 행을 보내야 할 때라 그러면 늘 유실된다. `sendBeacon` 은
 * 브라우저가 페이지를 정리한 뒤에도 전송을 마쳐 준다.
 */
export function sendUnanswered(input: Omit<SubmitInput, "verdict" | "reason">): void {
  if (typeof navigator === "undefined") return;

  const body = JSON.stringify(buildRow({ ...input, verdict: null, reason: null }));
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(FEEDBACK_PATH, blob)) return;
  } catch {
    /* sendBeacon 이 막힌 환경 — 아래로 떨어진다 */
  }

  // 떠나는 중이 아니면 이쪽으로도 도착한다. 실패해도 사용자를 막지 않는다
  void fetch(FEEDBACK_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
