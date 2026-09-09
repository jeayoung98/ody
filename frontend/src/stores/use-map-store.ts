import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { MapViewMode } from "@/constants";
import type { MapCamera } from "@/types";
import { getMapEngine } from "@/components/map/engine/engine-registry";

/** 빈 목록은 항상 같은 참조를 써서 셀렉터가 매번 새 배열을 만들지 않게 한다 */
const EMPTY_IDS: number[] = [];
const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 엔진이 프레임마다 밀어 넣는 읽기 전용 스냅샷 (HUD 표시용) */
export interface EngineSnapshot {
  layer: number;
  camera: MapCamera;
  /** 이 레이어에 상주하는 곡 수 */
  residentCount: number;
  /** 화면 중앙 보이지 않는 구멍 안 곡 수 */
  holeCount: number;
  /** 이 레이어에 들어온 배율 대비 현재 배율 (1 = 진입, DRILL.gateZoomMul 이상이면 파고들 준비) */
  zoomK: number;
  /** 구멍 안 곡 수가 게이트 이하 → 계속 확대하면 파고든다 */
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
}

interface MapState extends EngineSnapshot {
  viewMode: MapViewMode;
  selectedMusicId: number | null;
  /** 주변 탐색 모드의 기준 곡 */
  nearbyCenterMusicId: number | null;
  /** **재생 중인** 활동(여정/플리)의 별자리. 비어 있으면 재생 중인 별자리 없음 */
  constellationMusicIds: number[];
  /**
   * **미리보기** 별자리 — 재생하지 않고 패널로 열어만 본 목록 (PATH-01).
   * 이게 있으면 이쪽이 또렷하게 그려지고, 재생 중인 별자리는 흐린 선으로 남는다.
   */
  previewMusicIds: number[];
  /** 별자리 보기/숨기기 */
  constellationVisible: boolean;

  setViewMode: (mode: MapViewMode) => void;
  selectMusic: (musicId: number | null) => void;
  setMyMusicId: (musicId: number | null) => void;
  enterNearby: (musicId: number) => void;
  exitNearby: () => void;
  showConstellation: (musicIds: number[]) => void;
  clearConstellation: () => void;
  /** 재생하지 않고 목록만 열어봤을 때 (패널을 열면 호출) */
  previewConstellation: (musicIds: number[]) => void;
  clearPreview: () => void;
  toggleConstellationVisible: () => void;
  /** 카메라를 별자리에 맞추기 */
  fitConstellation: () => void;
  /** 별자리가 보이는 동안 보기 전용 레이어 전환 */
  jumpLayer: (layer: number) => void;
  /**
   * 곡 하나에 포커스 — 그 곡으로 확대하며 들어간다 (선택도 함께).
   * targetLayer 를 주면 그 레이어로 전환한 뒤 확대한다 (그 곡이 대표곡인 첫 레이어, SEARCH-01)
   */
  focusMusic: (musicId: number, targetLayer?: number | null) => void;
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
      holeCount: 0,
      zoomK: 1,
      gateOpen: false,
      atBottom: false,
      canRise: false,
      pressure: 0,
      pressureDir: 0,
      morph: null,
      myMusicId: null,

      viewMode: "default",
      selectedMusicId: null,
      nearbyCenterMusicId: null,
      constellationMusicIds: [],
      previewMusicIds: EMPTY_IDS,
      constellationVisible: true,

      setViewMode: (viewMode) => set({ viewMode }, false, "setViewMode"),
      selectMusic: (selectedMusicId) => set({ selectedMusicId }, false, "selectMusic"),
      setMyMusicId: (myMusicId) => {
        set({ myMusicId }, false, "setMyMusicId");
        getMapEngine()?.setMy(myMusicId);
      },

      enterNearby: (musicId) => {
        set({ viewMode: "nearby", nearbyCenterMusicId: musicId, selectedMusicId: musicId }, false, "enterNearby");
      },
      exitNearby: () => set({ viewMode: "default", nearbyCenterMusicId: null }, false, "exitNearby"),

      // 재생을 시작하면 그 목록이 "재생 중인 별자리"가 되고, 미리보기는 역할을 다한다
      showConstellation: (constellationMusicIds) =>
        set({ constellationMusicIds, previewMusicIds: EMPTY_IDS, constellationVisible: true }, false, "showConstellation"),
      clearConstellation: () => set({ constellationMusicIds: [] }, false, "clearConstellation"),

      previewConstellation: (musicIds) =>
        set(
          (s) => (s.constellationMusicIds.length >= 2 && sameIds(s.constellationMusicIds, musicIds) ? { previewMusicIds: EMPTY_IDS } : { previewMusicIds: musicIds, constellationVisible: true }),
          false,
          "previewConstellation",
        ),
      clearPreview: () => set({ previewMusicIds: EMPTY_IDS }, false, "clearPreview"),
      toggleConstellationVisible: () => set((s) => ({ constellationVisible: !s.constellationVisible }), false, "toggleConstellationVisible"),
      fitConstellation: () => getMapEngine()?.fitConstellation(),
      jumpLayer: (layer) => getMapEngine()?.jumpLayer(layer),

      focusMusic: (musicId, targetLayer) => {
        set({ selectedMusicId: musicId }, false, "focusMusic");
        getMapEngine()?.focusSong(musicId, targetLayer);
      },
      drillDown: () => getMapEngine()?.descend(),
      surface: () => getMapEngine()?.ascend(),

      syncFromEngine: (snap) => set(snap, false, "syncFromEngine"),
    }),
    { name: "map-store" },
  ),
);

/** 또렷하게 그리는 별자리 = 미리보기가 있으면 미리보기, 없으면 재생 중인 것 (PATH-01) */
export const brightConstellationIds = (s: MapState) => (s.previewMusicIds.length >= 2 ? s.previewMusicIds : s.constellationMusicIds);

/** 흐리게 남기는 별자리 = 미리보기가 위에 떠 있을 때의 재생 중인 별자리 */
export const ghostConstellationIds = (s: MapState) =>
  s.previewMusicIds.length >= 2 && s.constellationMusicIds.length >= 2 ? s.constellationMusicIds : EMPTY_IDS;
