"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import SurveyCard from "@/components/survey/survey-card";
import { QUERY_KEYS } from "@/constants";
import { connectSurveyPlayback } from "@/hooks/survey/playback-connection";
import { reportPlayback } from "@/lib/playback-events";
import { usePlayerStore } from "@/stores/use-player-store";
import { useSurveyStore } from "@/stores/use-survey-store";

/** Local browser fixture. Not routed/shipped. Simulates transport and HTTP only. */
export default function SurveyScreenFixture() {
  const client = useQueryClient();
  const id = usePlayerStore((s) => s.currentMusicId);
  const playing = usePlayerStore((s) => s.isPlaying);
  const [count, setCount] = useState(0);
  const [sameBody, setSameBody] = useState<boolean | null>(null);
  const requests = useRef<string[]>([]);
  useEffect(() => {
    client.setQueryData(QUERY_KEYS.journey.route(1, 3), { stops: [1, 2, 3].map((id) => ({ id, title: ["A", "B", "C"][id - 1], artist: "테스트", duration: 180 })) });
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (input === "/bff/feedback") {
        const rows = requests.current;
        rows.push(String(init?.body));
        setCount(rows.length);
        setSameBody(rows.length < 2 ? null : rows[0] === rows[1]);
        return new Response(JSON.stringify(rows.length === 1
          ? { success: false, data: null, error: { code: "INTERNAL_ERROR", message: "Simulated 503" } }
          : { success: true, data: { feedbackId: 1 }, error: null }), { status: rows.length === 1 ? 503 : 200 });
      }
      return original(input, init);
    };
    const disconnect = connectSurveyPlayback(client);
    return () => { window.fetch = original; disconnect(); };
  }, [client]);
  const prepare = async () => {
    useSurveyStore.setState(useSurveyStore.getInitialState(), true);
    requests.current = [];
    setCount(0);
    setSameBody(null);
    const heard = async () => {
      const p = usePlayerStore.getState();
      reportPlayback({ musicId: p.currentMusicId!, playSeq: p.playSeq, at: Date.now(), state: "playing" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    usePlayerStore.getState().playQueue({ kind: "journey", startMusicId: 1, endMusicId: 3 }, [1, 2, 3]);
    await heard(); usePlayerStore.getState().next(); await heard(); usePlayerStore.getState().next();
  };
  return (
    <main className="p-8 text-ink">
      <h1>설문 로컬 검증 — 운영 요청 없음</h1>
      <button className="border p-3" onClick={prepare}>A B 청취 후 C 요청</button>
      <p>현재 곡: {id == null ? "없음" : ["A", "B", "C"][id - 1]}</p>
      <p>재생 요청: {playing ? "재생" : "정지"}</p>
      <p>전송 횟수: {count}</p>
      <p>재시도 본문 동일: {sameBody == null ? "미시도" : String(sameBody)}</p>
      <SurveyCard />
    </main>
  );
}
