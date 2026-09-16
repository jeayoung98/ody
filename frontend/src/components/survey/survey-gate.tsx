"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ROUTES, TEST_TOOLS } from "@/constants";

const SurveyRunner = dynamic(() => import("./survey-runner"), { ssr: false });

/** Removable survey boundary: production disables every survey dependency here. */
export default function SurveyGate() {
  const pathname = usePathname();

  if (!TEST_TOOLS) {
    console.info("[TestTools] 테스트 도구가 비활성화되어 있습니다.");
    return null;
  }

  if (pathname !== ROUTES.home) return null;

  return <SurveyRunner />;
}
