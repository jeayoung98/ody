import type { QueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { GENRE_NAMES } from "@/constants/map";
import { api } from "@/lib/api";
import { subscribePlayback } from "@/lib/playback-events";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { JourneyRoute, NearbyResponse } from "@/types";
import type { Exploration } from "./listening-flow";

const RESOLVE_TIMEOUT_MS = 10_000;

function resolveSource(client: QueryClient): Promise<Exploration | null> {
  // An existing screen query might have no timeout; bound our wait as well.
  return new Promise<Exploration | null>((resolve) => {
    const timer = setTimeout(() => {
      console.warn("[survey] 탐색 결과 확인 시간이 초과되어 평가를 제외합니다.");
      resolve(null);
    }, RESOLVE_TIMEOUT_MS);
    void captureExploration(client).then(resolve, (error: unknown) => {
      console.warn("[survey] 탐색 결과를 확인하지 못해 이 재생의 평가를 제외합니다.", error);
      resolve(null);
    }).finally(() => clearTimeout(timer));
  });
}

/** Snapshot recommendation identity at playback intent, never at view change. */
function captureExploration(client: QueryClient): Promise<Exploration | null> {
  if (useFollowStore.getState().leaderEmail) return Promise.resolve(null);
  const p = usePlayerStore.getState();
  const map = useMapStore.getState();
  if (p.context.kind === "journey") {
    const { startMusicId, endMusicId } = p.context;
    const ids = [...p.queue];
    return client.ensureQueryData({
      queryKey: QUERY_KEYS.journey.route(startMusicId, endMusicId),
      queryFn: () => api<JourneyRoute>(`${API_ENDPOINTS.journey.route}?start=${startMusicId}&end=${endMusicId}`, {
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
      }),
    }).then((route): Exploration => ({
      key: `journey:${ids.join(",")}`, mode: "journey",
      // The playing queue, not a later refetch, defines the route being rated.
      stops: ids.map((id) => {
        const stop = route.stops.find((s) => s.id === id);
        const genreId = stop?.genreName == null ? -1 : GENRE_NAMES.indexOf(stop.genreName as (typeof GENRE_NAMES)[number]);
        return { musicId: id, title: stop?.title ?? `곡 ${id}`, artist: stop?.artist ?? null,
          genreId: genreId < 0 ? null : genreId, durationSec: stop?.duration };
      }),
    }));
  }
  const center = p.context.kind === "nearby" ? p.context.centerMusicId
    : p.context.kind === "single" && map.viewMode === "nearby" ? map.nearbyCenterMusicId : null;
  if (center == null) return Promise.resolve(null);
  return client.ensureQueryData({
    queryKey: QUERY_KEYS.map.nearby(center),
    queryFn: () => api<NearbyResponse>(API_ENDPOINTS.map.nearby(center), { signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS) }),
  }).then((data): Exploration => ({
    key: `nearby:${center}:${data.neighbors.map((s) => s.musicId).join(",")}`,
    mode: "nearby", center: { ...data.center }, neighbors: data.neighbors.map((song) => ({ ...song })),
  }));
}

/** The only adapter between survey policy and the application's playback. */
export function connectSurveyPlayback(client: QueryClient): () => void {
  const survey = useSurveyStore;
  const blocking = useBlockingStore;
  let disposed = false;
  let heardSeq: number | null = null;
  let source = resolveSource(client);

  const unwatchPlayer = usePlayerStore.subscribe((p, prev) => {
    if (!p.isPlaying) survey.getState().enter(null, false, Date.now());
    if (p.playSeq === prev.playSeq && p.currentMusicId === prev.currentMusicId) return;
    survey.getState().enter(null, false, Date.now());
    source = resolveSource(client);
  });

  const unwatchPlayback = subscribePlayback((event) => {
    const p = usePlayerStore.getState();
    if (event.musicId !== p.currentMusicId || event.playSeq !== p.playSeq) return;
    const s = survey.getState();
    if (event.state === "unavailable") { s.markUnplayable(event.musicId); return; }
    if (event.state === "paused") { s.enter(null, false, event.at); return; }
    if (!p.isPlaying || blocking.getState().busy) return;
    s.enter(event.musicId, true, event.at);
    if (heardSeq === event.playSeq) return;
    heardSeq = event.playSeq;
    s.setResolving(true);
    void source.then((exploration) => {
      if (disposed || usePlayerStore.getState().playSeq !== event.playSeq) return;
      survey.getState().hear(event.musicId, exploration);
    });
  });

  const gate = (resume: () => void) => {
    const held = survey.getState().gate(() => {
      blocking.getState().setBusy(false);
      resume();
    });
    if (held) {
      blocking.getState().setBusy(true);
      survey.getState().enter(null, false, Date.now());
      usePlayerStore.getState().pause();
    }
    return held;
  };
  blocking.getState().setGate(gate);

  return () => {
    disposed = true;
    unwatchPlayback();
    unwatchPlayer();
    if (blocking.getState().gate === gate) {
      blocking.getState().setGate(null);
      blocking.getState().setBusy(false);
    }
    survey.getState().resetListening();
  };
}
