import type { ActivityKind } from "@/constants";
import type { PlayContext } from "@/stores/use-player-store";

export interface PlaybackActivity {
  kind: ActivityKind;
  targetKey: string;
}

/** Stable identity shared by playback, activity switching, and map ownership. */
export function playContextKey(context: PlayContext): string {
  switch (context.kind) {
    case "single": return "single";
    case "playlist": return String(context.playlistId);
    case "journey": return `${context.startMusicId}-${context.endMusicId}`;
    case "nearby": return String(context.centerMusicId);
  }
}

export function samePlayContext(a: PlayContext, b: PlayContext): boolean {
  return a.kind === b.kind && playContextKey(a) === playContextKey(b);
}

/** The exploration represented by the map at the instant a star is played. */
export function visiblePlayContext(
  map: {
    viewMode: "default" | "nearby" | "constellation";
    nearbyCenterMusicId: number | null;
    constellationMusicIds: readonly number[];
    constellationSource: PlayContext | null;
  },
  musicId: number,
): PlayContext | undefined {
  if (map.viewMode === "nearby" && map.nearbyCenterMusicId != null) {
    return { kind: "nearby", centerMusicId: map.nearbyCenterMusicId };
  }
  if (map.viewMode === "constellation" && map.constellationSource
    && map.constellationMusicIds.includes(musicId)) return map.constellationSource;
  return undefined;
}

/** Manual sampling still owns its exploration; queue length only changes transport controls. */
export function playbackActivity(context: PlayContext, queueLength: number): PlaybackActivity | null {
  void queueLength;
  if (context.kind === "single") return null;
  return { kind: context.kind, targetKey: playContextKey(context) };
}

export function contextMatchesActivity(context: PlayContext | null, activity: PlaybackActivity): boolean {
  return context != null && context.kind === activity.kind && playContextKey(context) === activity.targetKey;
}

export function ownedMapRepresentation(
  map: {
    viewMode: "default" | "nearby" | "constellation";
    nearbyCenterMusicId: number | null;
    constellationSource: PlayContext | null;
  },
  activity: PlaybackActivity,
): "nearby" | "constellation" | null {
  if (activity.kind === "nearby") {
    const source = map.nearbyCenterMusicId == null
      ? null
      : { kind: "nearby" as const, centerMusicId: map.nearbyCenterMusicId };
    return map.viewMode === "nearby" && contextMatchesActivity(source, activity) ? "nearby" : null;
  }
  return contextMatchesActivity(map.constellationSource, activity) ? "constellation" : null;
}

/** Manual picks in the same exploration never count as leaving its list. */
export function shouldConfirmListExit(
  context: PlayContext,
  queue: readonly number[],
  musicId: number,
  origin?: PlayContext,
): boolean {
  if (context.kind === "single" || queue.length === 0 || queue.includes(musicId)) return false;
  return !origin || !samePlayContext(context, origin);
}
