import type { MapViewMode } from "@/constants";
import type { PlayContext } from "@/stores/use-player-store";
import type { RideViewRequest } from "@/types";

/**
 * 지도 상태 → 선단에 알릴 화면 종류 (S15P21A405-653). 순수 함수 — `tests/ride-view.test.cjs` 가 묶는다.
 *
 * `constellation` 은 목록의 출처로 갈린다: 여정이면 시작·끝곡, 플리면 번호. 출처가 없거나 다른 것(단일·주변)이면
 * 받는 쪽이 재현할 길이 없으니 **기본**으로 말한다 — 없는 화면을 있는 척 보내면 `RIDE_VIEW_INVALID` 만 돌아온다.
 */
export function rideViewOf(s: { viewMode: MapViewMode; constellationSource: PlayContext | null; nearbyCenterMusicId: number | null }): RideViewRequest {
  if (s.viewMode === "nearby" && s.nearbyCenterMusicId != null) return { kind: "nearby", centerMusicId: s.nearbyCenterMusicId };
  if (s.viewMode === "constellation" && s.constellationSource) {
    const src = s.constellationSource;
    if (src.kind === "journey") return { kind: "journey", startMusicId: src.startMusicId, endMusicId: src.endMusicId };
    if (src.kind === "playlist") return { kind: "playlist", playlistId: src.playlistId };
  }
  return { kind: "default" };
}

/** 같은 화면인가 — 종류와 그 종류의 번호가 같으면 같다. 바뀌었을 때만 보내려는 것 */
export function sameRideView(a: RideViewRequest, b: RideViewRequest): boolean {
  return a.kind === b.kind && a.startMusicId === b.startMusicId && a.endMusicId === b.endMusicId && a.playlistId === b.playlistId && a.centerMusicId === b.centerMusicId;
}
