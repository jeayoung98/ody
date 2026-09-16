import { journeyEdge, nearbyEdge, type Trail } from "./edge-rules";
import { questionKey, type SurveyEdge, type SurveySong } from "@/types/survey";

export type Exploration =
  | { key: string; mode: "nearby"; center: SurveySong; neighbors: readonly SurveySong[] }
  | { key: string; mode: "journey"; stops: readonly SurveySong[] };

export interface ListeningFlow extends Trail {
  key: string;
  sessionId: string;
  slots: ReadonlyMap<number, string>;
}

export function containsSong(source: Exploration, id: number): boolean {
  return source.mode === "nearby"
    ? source.center.musicId === id || source.neighbors.some((song) => song.musicId === id)
    : source.stops.some((song) => song.musicId === id);
}

/** Only call on the first confirmed PLAYING report for a playback generation. */
export function hearSong(
  source: Exploration | null,
  musicId: number,
  previous: ListeningFlow | null,
  lastAudible: number | null,
  unavailable: ReadonlySet<number>,
  newId: () => string,
): { flow: ListeningFlow | null; edge: SurveyEdge | null } {
  if (!source || !containsSong(source, musicId)) return { flow: null, edge: null };
  const continuing = previous?.key === source.key;
  // A just-heard center can seed a new exploration. D merely selected cannot.
  const seed = lastAudible != null && containsSong(source, lastAudible) ? lastAudible : null;
  const flow: ListeningFlow = continuing ? { ...previous, unplayable: unavailable } : {
    key: source.key, sessionId: newId(), slots: new Map(),
    played: new Set(seed == null ? [] : [seed]), lastPlayed: seed, unplayable: unavailable,
  };
  let edge = source.mode === "nearby"
    ? nearbyEdge(musicId, flow, { ...source, sessionId: flow.sessionId })
    : journeyEdge(musicId, flow, { ...source, sessionId: flow.sessionId });
  let sessionId = flow.sessionId;
  let slots = new Map(flow.slots);
  if (edge) {
    const key = questionKey(edge.target);
    // Backend upserts by (session, rank), not question. Never reuse a row for
    // a different predecessor after an unavailable song becomes playable.
    if (slots.has(edge.target.rank) && slots.get(edge.target.rank) !== key) {
      sessionId = newId();
      slots = new Map();
      edge = { ...edge, target: { ...edge.target, sessionId } };
    }
    slots.set(edge.target.rank, key);
  }
  return { flow: { ...flow, sessionId, slots, played: new Set(flow.played).add(musicId), lastPlayed: musicId }, edge };
}
