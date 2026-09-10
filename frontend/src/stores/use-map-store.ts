import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { GENRE_NAMES, type MapViewMode } from "@/constants";
import type { MapCamera } from "@/types";
import { getMapEngine } from "@/components/map/engine/engine-registry";

/** 빈 목록은 항상 같은 참조를 써서 셀렉터가 매번 새 배열을 만들지 않게 한다 */
const EMPTY_IDS: number[] = [];
/** 장르 전부 켜진 상태 (같은 참조 유지) */
const ALL_GENRES: number[] = GENRE_NAMES.map((_, i) => i);

/** 엔진이 프레임마다 밀어 넣는 읽기 전용 스냅샷 (HUD 표시용) */
export interface EngineSnapshot {
  layer: number;
  camera: MapCamera;
  /** 이 레이어에 상주하는 곡 수 */
  residentCount: number;
  /** 그중 화면 안에 들어와 있는 곡 수 — 다음 단계로 데려갈 후보 */
  viewportCount: number;
  /** 이 레이어에 들어온 배율 대비 현재 배율 (1 = 진입, DRILL.gateZoomMul 이상이면 파고들 준비) */
  zoomK: number;
  /** 확대 임계치를 넘겼다 → 계속 확대하면 파고든다 */
  gateOpen: boolean;
  /** 마지막 레이어 */
  atBottom: boolean;
  /** 되돌아갈 상위 프레임이 있다 */
  canRise: boolean;
  /** 스크롤 압력 0~1, 방향(1 파고들기 / -1 떠오르기) */
  pressure: number;
  pressureDir: 1 | -1 | 0;
  /** 모프 진행 중 안내 문구 */
  morph: { big: string; sub: string } | null;
  /** 내 곡 = 내 위치. 파고들 때 구멍 밖이면 엔진이 바꿀 수 있다 */
  myMusicId: number | null;
  /** 고스트별로 띄운 곡 (MAP-12). 없으면 null */
  ghostMusicId: number | null;
  /** 재생 중인 곡이 이 겹 밖인가 (MAP-08) */
  playingElsewhere: boolean;
}

interface MapState extends EngineSnapshot {
  viewMode: MapViewMode;
  /** 필터에서 켜 둔 장르. 꺼진 장르는 지도에서 형태만 남는다 */
  litGenres: number[];
  selectedMusicId: number | null;
  /** 주변 탐색 모드의 기준 곡 */
  nearbyCenterMusicId: number | null;
  /**
   * 지금 별자리로 볼 수 있는 곡 목록 (여정/플리 순서). **뷰가 꺼져 있어도 남아 있다** —
   * 좌상단 `별자리 뷰` 택이 이 목록이 있을 때 뜨고, 그 택으로 뷰를 껐다 켠다 (PATH-01).
   */
  constellationMusicIds: number[];

  setViewMode: (mode: MapViewMode) => void;
  /** 장르 칩 토글 — 전부 켜진 상태에서 누르면 그 장르만 남기고(솔로), 마지막 하나를 끄면 전부 켜진다 */
  toggleGenre: (genreId: number) => void;
  showAllGenres: () => void;
  selectMusic: (musicId: number | null) => void;
  setMyMusicId: (musicId: number | null) => void;
  enterNearby: (musicId: number) => void;
  exitNearby: () => void;
  /** 목록을 넣고 별자리 뷰를 바로 켠다. 주변 탐색이 켜져 있으면 닫힌다 (PATH-01-1) */
  showConstellation: (musicIds: number[]) => void;
  /** 목록만 갈아끼운다 (뷰는 건드리지 않음) — 패널을 열었을 때 택만 뜨게 */
  setConstellationList: (musicIds: number[]) => void;
  /** 좌상단 택 — 별자리 뷰를 껐다 켰다 */
  toggleConstellationView: () => void;
  /** 목록까지 비운다 (경로 지우기) */
  clearConstellation: () => void;
  /**
   * 검색 결과를 골랐을 때 (SEARCH-01).
   * 이 겹에 있으면 그 곡으로 확대하고, 없으면 고스트별로 띄운다 (MAP-12) — 레이어를 자동으로 옮기지 않는다.
   */
  focusMusic: (musicId: number) => void;
  /** 고스트별의 곡이 있는 곳으로 간다 — 레이어 0으로 떠오른 뒤 그 곡을 확대 (MAP-12) */
  surfaceToMusic: (musicId: number) => void;
  /** 다음 레이어로 파고들기 (게이트가 열려 있을 때만 동작) */
  drillDown: () => void;
  /** 상위 레이어로 떠오르기 */
  surface: () => void;
  /** 엔진 → 스토어 동기화 */
  syncFromEngine: (snap: Partial<EngineSnapshot>) => void;
}

export const useMapStore = create<MapState>()(
  devtools(
    (set) => ({
      layer: 0,
      camera: { cx: 0, cy: 0, s: 100 },
      residentCount: 0,
      viewportCount: 0,
      zoomK: 1,
      gateOpen: false,
      atBottom: false,
      canRise: false,
      pressure: 0,
      pressureDir: 0,
      morph: null,
      myMusicId: null,
      ghostMusicId: null,
      playingElsewhere: false,

      viewMode: "default",
      litGenres: ALL_GENRES,
      selectedMusicId: null,
      nearbyCenterMusicId: null,
      constellationMusicIds: EMPTY_IDS,

      setViewMode: (viewMode) => set({ viewMode }, false, "setViewMode"),
      toggleGenre: (genreId) =>
        set(
          (s) => {
            if (s.litGenres.length === ALL_GENRES.length) return { litGenres: [genreId] };
            const next = s.litGenres.includes(genreId) ? s.litGenres.filter((g) => g !== genreId) : [...s.litGenres, genreId];
            return { litGenres: next.length ? next : ALL_GENRES };
          },
          false,
          "toggleGenre",
        ),
      showAllGenres: () => set({ litGenres: ALL_GENRES }, false, "showAllGenres"),
      selectMusic: (selectedMusicId) => set({ selectedMusicId }, false, "selectMusic"),
      setMyMusicId: (myMusicId) => {
        set({ myMusicId }, false, "setMyMusicId");
        getMapEngine()?.setMy(myMusicId);
      },

      // 오버레이 뷰는 하나만 (PATH-01-1) — 주변 탐색을 켜면 별자리가 닫히고, 그 반대도 마찬가지
      enterNearby: (musicId) => {
        set(
          { viewMode: "nearby", nearbyCenterMusicId: musicId, selectedMusicId: musicId, constellationMusicIds: EMPTY_IDS },
          false,
          "enterNearby",
        );
      },
      exitNearby: () => set({ viewMode: "default", nearbyCenterMusicId: null }, false, "exitNearby"),

      showConstellation: (constellationMusicIds) =>
        set({ viewMode: "constellation", constellationMusicIds, nearbyCenterMusicId: null }, false, "showConstellation"),
      setConstellationList: (constellationMusicIds) => set({ constellationMusicIds }, false, "setConstellationList"),
      toggleConstellationView: () =>
        set(
          (s) =>
            s.viewMode === "constellation"
              ? { viewMode: "default" }
              : { viewMode: "constellation", nearbyCenterMusicId: null },
          false,
          "toggleConstellationView",
        ),
      clearConstellation: () =>
        set((s) => ({ viewMode: s.viewMode === "constellation" ? "default" : s.viewMode, constellationMusicIds: EMPTY_IDS }), false, "clearConstellation"),

      focusMusic: (musicId) => {
        const engine = getMapEngine();
        set({ selectedMusicId: musicId }, false, "focusMusic");
        // 이 겹에 있으면 확대, 없으면 "범위 밖에 있다"고 치고 고스트별로 (MAP-12)
        if (engine?.isAlive(musicId)) engine.focusSong(musicId);
        else engine?.setGhost(musicId);
      },
      surfaceToMusic: (musicId) => {
        set({ selectedMusicId: musicId }, false, "surfaceToMusic");
        getMapEngine()?.surfaceToSong(musicId);
      },
      drillDown: () => getMapEngine()?.descend(),
      surface: () => getMapEngine()?.ascend(),

      syncFromEngine: (snap) => set(snap, false, "syncFromEngine"),
    }),
    { name: "map-store" },
  ),
);

/** 별자리 뷰가 열려 있는가 (PATH-01) */
export const isConstellationOpen = (s: MapState) => s.viewMode === "constellation" && s.constellationMusicIds.length >= 2;
