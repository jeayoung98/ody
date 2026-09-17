"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS } from "@/constants/analytics";
import { analyticsId, track } from "@/lib/analytics/client";

interface SearchSnapshot { keyword: string; visible: boolean; pending: boolean; count: number; pages: number; source: string }
/** 타이핑 API 횟수 대신 500ms 멈춘 검색 의도와 표시된 결과를 기록한다. */
export function useSearchAnalytics(snapshot: SearchSnapshot) {
  const current = useRef(snapshot);
  const mount = useRef(0);
  const flow = useRef({ open: false, id: "", term: "", shown: "" });
  useEffect(() => { current.current = snapshot; });
  const execute = () => {
    const s = current.current;
    const term = s.keyword.trim();
    if (!term) return;
    const f = flow.current;
    if (!f.open) { f.open = true; track("search_opened", { source: s.source }); }
    if (f.term !== term || !f.id) {
      f.id = analyticsId(); f.term = term; f.shown = "";
      track("search_executed", { search_id: f.id, source: s.source, query_length: term.length });
    }
    const shown = `${s.pages}:${s.count}`;
    if (!s.pending && s.pages > 0 && f.shown !== shown) {
      f.shown = shown;
      track("search_results_viewed", { search_id: f.id, source: s.source, result_count: s.count, page_count: s.pages });
    }
  };
  const executeRef = useRef(execute);
  useEffect(() => { executeRef.current = execute; });
  useEffect(() => {
    const f = flow.current;
    if (snapshot.visible && !f.open) { f.open = true; track("search_opened", { source: snapshot.source }); }
    if (!snapshot.visible) {
      if (f.open) track("search_closed", { search_id: f.id, source: snapshot.source });
      f.open = false; f.id = ""; f.term = ""; f.shown = "";
      return;
    }
    const timer = setTimeout(() => executeRef.current(), ANALYTICS.searchSettleMs);
    return () => clearTimeout(timer);
  }, [snapshot.keyword, snapshot.visible, snapshot.pending, snapshot.count, snapshot.pages, snapshot.source]);
  useEffect(() => {
    const mountCounter = mount;
    const generation = ++mountCounter.current;
    const f = flow.current;
    return () => { queueMicrotask(() => {
      if (generation === mountCounter.current && f.open) {
        track("search_closed", { search_id: f.id, source: current.current.source, reason: "unmount" });
        f.open = false;
      }
    }); };
  }, []);
  return {
    select: (musicId: number, rank: number) => {
      execute(); // 500ms 전에 고른 검색도 분모에 남긴다.
      track("search_result_selected", { search_id: flow.current.id, source: snapshot.source, music_id: musicId, rank });
    },
    more: () => { execute(); track("search_more_requested", { search_id: flow.current.id, source: snapshot.source, page_count: snapshot.pages }); },
  };
}
