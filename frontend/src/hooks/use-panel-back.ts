"use client";

import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/constants";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { usePlaylistDetailQuery } from "@/hooks/queries/use-playlist-detail-query";
import { useUserProfileQuery } from "@/hooks/queries/use-user-profile-query";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import type { PanelReturn } from "@/lib/panel-history";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";

interface PanelBack {
  target: PanelReturn;
  /** 돌아갈 자리의 이름 — 곡이면 제목, 플리면 이름, 사람이면 닉네임 */
  label: string;
  go: () => void;
}

const FOLLOWS_LABEL = { follower: "팔로워 목록", following: "팔로잉 목록" } as const;

/**
 * **돌아갈 자리**와 그 이름 (S15P21A405-316 · 384 · 659).
 *
 * 모든 패널의 ← 버튼이 같은 답을 쓰도록 한 곳에 모았다. 패널 제목은 이 답을 쓰지 않는다 — 늘 제 이름이다 (S15P21A405-716).
 *
 * 돌아갈 자리를 두 군데서 찾는다.
 * 1. **어떻게 들어왔나** — 패널 안에서 눌러 타고 들어왔으면 스택(`history`)의 마지막이다
 * 2. **지금 무엇을 듣고 있나** — 곡 상세에서, 여정·플리가 진행 중이고 이 곡이 그 목록 안에 있으면 지도에서
 *    바로 눌러 열었더라도 그 목록으로 돌아갈 수 있다
 *
 * **폰에서 탭 화면으로 돌아갈 때는 주소를 옮긴다.** 차트·주변 사람·마이페이지는 좁은 화면에서 지도 위 시트가
 * 아니라 하단 탭 화면이다 — 시트로 되살리면 그 화면이 두 곳에 선다. 들어올 때 `use-open-profile` 이 지도로
 * 옮겨 왔으니 나갈 때는 그 반대다.
 */
export function usePanelBack(): PanelBack | null {
  const history = usePanelStore((s) => s.history);
  const activePanel = usePanelStore((s) => s.activePanel);
  const musicId = usePanelStore((s) => s.musicId);
  const goBack = usePanelStore((s) => s.goBack);
  const close = usePanelStore((s) => s.close);
  const openJourney = usePanelStore((s) => s.openJourney);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const ids = useMapStore((s) => s.constellationMusicIds);
  const source = useMapStore((s) => s.constellationSource);
  const narrow = useIsNarrow();
  const router = useRouter();
  const pathname = usePathname();

  const last = history[history.length - 1] ?? null;
  // 곡 상세에서만: 지금 켜져 있는 목록 안의 곡이면 그 목록이 돌아갈 자리다
  const inList = activePanel === "song" && musicId != null && source != null && ids.includes(musicId);
  const target: PanelReturn | null =
    last ??
    (inList && source.kind === "journey"
      ? { panel: "journey" }
      : inList && source.kind === "playlist"
        ? { panel: "playlist", playlistId: source.playlistId }
        : null);

  // 이름표는 캐시에서 온다 — 방금까지 보던 것들이라 대개 있다
  const { data: backSong } = useMusicDetailQuery(target?.panel === "song" ? target.musicId : null);
  const { data: backPlaylist } = usePlaylistDetailQuery(target?.panel === "playlist" ? target.playlistId : null);
  const { data: backProfile } = useUserProfileQuery(target?.panel === "feed" ? target.profileEmail : null);
  if (!target) return null;

  return {
    target,
    label: labelOf(target, { song: backSong?.title, playlist: backPlaylist?.playlistName, nickname: backProfile?.nickname }),
    go: () => {
      if (!last) {
        // 스택은 없지만 듣고 있는 목록이 있다 — 그 패널을 새로 연다
        if (target.panel === "journey") openJourney();
        else if (target.panel === "playlist") openPlaylist(target.playlistId);
        return;
      }
      const route = narrow ? tabRouteOf(target) : null;
      if (route) {
        close();
        if (pathname !== route) router.push(route);
        return;
      }
      goBack();
    },
  };
}

function labelOf(t: PanelReturn, names: { song?: string; playlist?: string; nickname?: string | null }): string {
  switch (t.panel) {
    case "song":
      return names.song ?? "직전 곡";
    case "playlist":
      return names.playlist ?? "플레이리스트";
    case "journey":
      return "여정";
    case "friends":
      return "주변 사람";
    case "chart":
      return "차트";
    case "feed": {
      const who = t.profileEmail == null ? "마이페이지" : (names.nickname ?? "프로필");
      return t.follows ? `${who} · ${FOLLOWS_LABEL[t.follows]}` : who;
    }
  }
}

/** 좁은 화면에서 하단 탭 화면인 자리. 그 밖은 지도 위 시트라 `null` */
function tabRouteOf(t: PanelReturn): string | null {
  if (t.panel === "chart") return ROUTES.chart;
  if (t.panel === "friends") return ROUTES.friends;
  if (t.panel === "feed" && t.profileEmail == null) return ROUTES.me;
  return null;
}
