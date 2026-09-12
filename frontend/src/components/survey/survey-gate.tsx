"use client";

import dynamic from "next/dynamic";

/**
 * 설문 마운트 지점 (S15P21A405-250).
 *
 * **기존 코드에 남는 건 이 컴포넌트를 렌더하는 한 줄뿐이다.** 걷어낼 때는 그 한 줄을 지우고
 * survey 관련 파일(components/survey, hooks/survey, stores/use-survey-store,
 * constants/survey, types/survey, lib/anonymous-id, app/api/feedback)을 삭제하면 끝난다.
 *
 * 본체를 **동적으로 불러온다** — `NEXT_PUBLIC_SURVEY_ENABLED` 가 꺼진 빌드에서는
 * 설문 코드가 초기 번들에 들어가지 않고 받아오지도 않는다. 정적 import 로 두면
 * 화면에 안 보여도 코드는 그대로 실린다.
 *
 * `ssr: false` 인 이유: 설문은 localStorage(익명 ID)와 브라우저 상태에 기대므로
 * 서버에서 그릴 것이 없다.
 */
const ENABLED = process.env.NEXT_PUBLIC_SURVEY_ENABLED === "true";

const SurveyRunner = dynamic(() => import("./survey-runner"), { ssr: false });

export default function SurveyGate() {
  if (!ENABLED) return null;
  return <SurveyRunner />;
}
