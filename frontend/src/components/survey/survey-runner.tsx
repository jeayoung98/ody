"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSurveyPlayback } from "@/hooks/survey/playback-connection";
import { sendUnanswered } from "@/hooks/survey/submission";
import { useLoadAnswered } from "@/hooks/survey/use-load-answered";
import { useSurveyStore } from "@/stores/use-survey-store";
import SurveyCard from "./survey-card";

/** All survey integration lives below this removable boundary. */
export default function SurveyRunner() {
  const client = useQueryClient();
  useLoadAnswered();

  useEffect(() => connectSurveyPlayback(client), [client]);

  useEffect(() => {
    const onLeave = () => {
      const s = useSurveyStore.getState();
      s.enter(null, false, Date.now());
      const edge = s.takeUnanswered();
      if (edge) {
        sendUnanswered({
          target: edge.target,
          listenedMs: s.stintMs(edge.target.musicId),
          skipped: false,
          durationSec: edge.subject.durationSec,
        });
      }
    };
    const onReturn = (event: PageTransitionEvent) => {
      if (event.persisted) useSurveyStore.getState().resumeAfterPagehide();
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("pageshow", onReturn);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("pageshow", onReturn);
    };
  }, []);

  return <SurveyCard />;
}
