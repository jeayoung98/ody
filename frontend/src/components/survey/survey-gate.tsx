"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants";
import { useSurveyMode } from "@/hooks/use-survey-mode";

const SurveyRunner = dynamic(() => import("./survey-runner"), { ssr: false });

/** Removable survey boundary: production disables every survey dependency here. */
export default function SurveyGate() {
  const pathname = usePathname();
  // 빌드 스위치(TEST_TOOLS)와 브라우저별 스위치를 합친 값 (S15P21A405-383)
  const surveyMode = useSurveyMode();

  if (!surveyMode) return null;

  if (pathname !== ROUTES.home) return null;

  return <SurveyRunner />;
}
