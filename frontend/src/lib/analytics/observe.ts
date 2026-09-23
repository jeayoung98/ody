import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { subscribePlayback } from "@/lib/playback-events";
import { analyticsId, setAnalyticsContext, track } from "./client";
import { endPlayback, playbackMeter, reportActualPlayback, requestPlayback } from "./playback";

let installed = false;
export function observeAnalytics(): void {
  if (installed) return;
  installed = true;
  setAnalyticsContext({ view_mode: useMapStore.getState().viewMode, playback_context: usePlayerStore.getState().context.kind });
  useMapStore.subscribe((s, p) => {
    if (s.viewMode !== p.viewMode) {
      if (p.viewMode === "nearby") track("nearby_closed", { center_music_id: p.nearbyCenterMusicId });
      setAnalyticsContext({ view_mode: s.viewMode, nearby_id: s.viewMode === "nearby" ? analyticsId() : undefined });
      track("view_mode_changed", { previous_mode: p.viewMode });
      if (s.viewMode === "nearby") track("nearby_opened", { center_music_id: s.nearbyCenterMusicId });
    } else if (s.viewMode === "nearby" && s.nearbyCenterMusicId !== p.nearbyCenterMusicId) {
      track("nearby_center_changed", { previous_music_id: p.nearbyCenterMusicId, center_music_id: s.nearbyCenterMusicId });
    }
    if (s.layer !== p.layer) track("map_layer_changed", { previous_layer: p.layer, layer: s.layer });
  });
  usePanelStore.subscribe((s, p) => {
    if (s.activePanel !== p.activePanel) track("panel_changed", { panel: s.activePanel ?? "none", previous_panel: p.activePanel ?? "none" });
    if (s.snap !== p.snap) track("panel_collapsed_changed", { panel: s.activePanel, collapsed: s.snap === 1, snap: s.snap });
    // 상세 패널이 펼쳐진 사실. 실제 데이터 성공/실패는 QueryCache에서 따로 확인한다.
    if (s.activePanel === "song" && s.snap > 1 && (p.activePanel !== "song" || p.musicId !== s.musicId || p.snap === 1)) {
      track("music_detail_viewed", { music_id: s.musicId });
    }
  });
  useJourneyStore.subscribe((s, p) => {
    if (s.isComposerOpen !== p.isComposerOpen) track(s.isComposerOpen ? "journey_composer_opened" : "journey_composer_closed", { route_requested: s.isRouteRequested });
    for (const slot of ["start", "end"] as const) {
      const key = slot === "start" ? "startMusicId" : "endMusicId";
      if (s[key] !== p[key]) track("journey_endpoint_changed", { slot, music_id: s[key], previous_music_id: p[key] });
    }
    if (p.isRouteRequested && !s.isRouteRequested && s.startMusicId == null && s.endMusicId == null) {
      track("journey_cleared");
      setAnalyticsContext({ journey_id: undefined });
    }
  });
  usePlayerStore.subscribe((s, p) => {
    if (s.context.kind !== p.context.kind) setAnalyticsContext({ playback_context: s.context.kind });
    const newTrack = s.currentMusicId !== p.currentMusicId || s.playSeq !== p.playSeq;
    if (s.currentMusicId == null) { if (p.currentMusicId != null) endPlayback("stopped"); return; }
    if (s.playSeq !== p.playSeq) track("queue_play_requested", { queue_count: s.queue.length, queue_index: s.queueIndex, music_id: s.currentMusicId });
    if ((newTrack && s.isPlaying) || (s.isPlaying && !p.isPlaying && !playbackMeter.isActive())) {
      const c = s.context;
      requestPlayback(s.currentMusicId, {
        playback_context: c.kind, queue_index: s.queueIndex, queue_count: s.queue.length,
        center_music_id: c.kind === "nearby" ? c.centerMusicId : undefined,
        start_music_id: c.kind === "journey" ? c.startMusicId : undefined,
        end_music_id: c.kind === "journey" ? c.endMusicId : undefined,
      });
    } else if (newTrack) endPlayback("selected_while_paused");
  });
  subscribePlayback((event) => reportActualPlayback(event.musicId, event.state));
  const updateBlocking = () => {
    const busy = useBlockingStore.getState().busy;
    setAnalyticsContext({ blocked: busy || !!useConfirmStore.getState().pending });
  };
  useBlockingStore.subscribe(updateBlocking);
  useConfirmStore.subscribe((s, p) => {
    updateBlocking();
    if (s.pending && s.pending !== p.pending) track("activity_switch_prompted");
  });
  window.addEventListener("pagehide", () => endPlayback("pagehide"));
}
