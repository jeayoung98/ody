import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { MapViewMode } from "@/constants";
import type { LayerBox, MapCamera, MapPoint } from "@/types";
import type { GoHomeResult } from "@/components/map/engine/map-engine";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import type { PlayContext } from "./use-player-store";

/** 빈 목록은 항상 같은 참조를 써서 셀렉터가 매번 새 배열을 만들지 않게 한다 */
const EMPTY_IDS: number[] = [];
const EMPTY_POINTS: MapPoint[] = [];
const EMPTY_BOXES: LayerBox[] = [];

/** 엔진이 프레임마다 밀어 넣는 읽기 전용 스냅샷 (HUD 표시용) */
export interface EngineSnapshot {
  layer: number;
  /**
   * 겹마다 화면으로 좁혀 온 누적 범위 (길이 = 현재 레이어 번호).
   * 다음 겹 상주 집합을 요청하는 조건이라 이게 바뀌면 곡을 새로 받는다.
   */
  boxes: readonly LayerBox[];
  /**
   * 압력이 차는 동안 엔진이 미리 정한 다음 겹 요청 범위. 화면은 이 키로 곡을 **미리 받아** 둔다 —
   * 파고든 뒤에 도착하면 임시 집합 → 실제 집합 교체가 한 번 더 보인다 (S15P21A405-284)
   */
  prefetchBoxes: readonly LayerBox[] | null;
  camera: MapCamera;
  /** 이 레이어에 상주하는 곡 수 */
  residentCount: number;
  /** 그중 화면 안에 들어와 있는 곡 수 — 다음 단계로 데려갈 후보 */
  viewportCount: number;
  /** 이 레이어에 들어온 배율 대비 현재 배율 (1 = 진입) */
  zoomK: number;
  /** 확대 임계치를 넘겼다 → 계속 확대하면 파고든다 */
  gateOpen: boolean;
  /** 게이트까지의 진행도 0~1. 안내 막대가 이 값으로 찬다 (S15P21A405-342) */
  gateProgress: number;
  /** 게이트가 열리는 화면 안 곡 수 (밀도 × 보이는 넓이) */
  gateAtCount: number;
  /** 마지막 레이어 */
  atBottom: boolean;
  /** 되돌아갈 상위 프레임이 있다 */
  canRise: boolean;
  /** 스크롤 압력 0~1, 방향(1 파고들기 / -1 떠오르기) */
  pressure: number;
  pressureDir: 1 | -1 | 0;
  /** 모프 진행 중 안내 문구 */
  /** 전환 안내. `sub` 는 겹을 불러오는 중일 때만 있다 — 축 문장은 지도 가장자리가 맡는다 (S15P21A405-358) */
  morph: { big: string; sub?: string } | null;
  /** 내 곡 = 내 위치. 곡을 재생해야 생긴다 — 없으면 표식을 그리지 않는다 */
  myMusicId: number | null;
  /**
   * "내 위치로 가기" 가 돌아갈 자리. 겹까지 되돌아가야 해서 누적 범위(`boxes`)가 함께 온다.
   * 새로고침 뒤에도 살아 있도록 localStorage 에 저장한다 (S15P21A405-275).
   */
  home: { musicId: number; boxes: readonly LayerBox[] } | null;
  /** 고스트별로 띄운 곡 (MAP-12). 없으면 null */
  ghostMusicId: number | null;
  /** 재생 중인 곡이 이 겹 밖인가 (MAP-08) */
  playingElsewhere: boolean;
  /** "내 위치로 가기" 로 돌아갈 자리가 있는가 (재생한 적이 있는가) */
  canGoHome: boolean;
}

interface MapState extends EngineSnapshot {
  viewMode: MapViewMode;
  selectedMusicId: number | null;
  /** 주변 탐색 모드의 기준 곡 */
  nearbyCenterMusicId: number | null;
  /**
   * 지금 별자리로 볼 수 있는 곡 목록 (여정/플리 순서). **뷰가 꺼져 있어도 남아 있다** —
   * 좌상단 `별자리 뷰` 택이 이 목록이 있을 때 뜨고, 그 택으로 뷰를 껐다 켠다 (PATH-01).
   */
  constellationMusicIds: number[];
  /**
   * 그 곡들의 16차원 좌표. 여정 경로 곡은 **지도 상주 집합 밖일 수 있어서** 엔진이 좌표를 모른다 —
   * 배치를 만들려면 목록과 함께 받아 엔진에 편입해야 한다. 플리(목)처럼 좌표를 모르면 빈 배열
   */
  constellationPoints: MapPoint[];
  /**
   * 이 목록이 **어디서 온 것인가** (여정인지 플리인지, 그 식별자까지).
   *
   * 목록 안의 곡을 재생할 때 단일 재생으로 떨어지지 않고 그 목록으로 이어가려면
   * 곡 ID 만으로는 부족하다 — 큐에 넣을 순서와 함께 `context` 를 복원해야 하기 때문이다
   * (`use-player-store` 의 `playSingle` 참고).
   */
  constellationSource: PlayContext | null;

  setViewMode: (mode: MapViewMode) => void;
  selectMusic: (musicId: number | null) => void;
  setMyMusicId: (musicId: number | null) => void;
  /**
   * 주변 탐색을 켠다. `panelHandled` 는 **부른 쪽이 패널을 직접 정했다**는 뜻이다
   * (S15P21A405-384) — `map-view` 의 "중심곡 상세도 같이 연다" 효과(348)가 이 값을 보고
   * 비켜난다. 이웃 카드를 고를 때처럼 중심곡이 아니라 **고른 곡**의 상세를 띄워야 할 때 쓴다.
   */
  enterNearby: (musicId: number, panelHandled?: boolean) => void;
  exitNearby: () => void;
  /** {@link enterNearby} 참고. 효과가 읽고 나면 다음 enterNearby 가 다시 정한다 */
  nearbyPanelHandled: boolean;
  /** 목록을 넣고 별자리 뷰를 바로 켠다. 주변 탐색이 켜져 있으면 닫힌다 (PATH-01-1) */
  showConstellation: (musicIds: number[], points: MapPoint[] | undefined, source: PlayContext) => void;
  /** 목록만 갈아끼운다 (뷰는 건드리지 않음) — 패널을 열었을 때 택만 뜨게 */
  setConstellationList: (musicIds: number[], points: MapPoint[] | undefined, source: PlayContext) => void;
  /** 좌상단 택 — 별자리 뷰를 껐다 켰다 */
  toggleConstellationView: () => void;
  /**
   * 별자리 뷰만 끈다 (목록·좌표는 남긴다). 패널을 닫을 때 쓴다 (S15P21A405-316) —
   * 별자리는 패널에 딸린 화면이라 패널이 사라지면 같이 사라져야 한다.
   */
  hideConstellationView: () => void;
  /** 목록까지 비운다 (경로 지우기) */
  clearConstellation: () => void;
  /**
   * 검색 결과를 골랐을 때 (SEARCH-01).
   * 이 겹에 있으면 그 곡으로 확대하고, 없으면 고스트별로 띄운다 (MAP-12) — 레이어를 자동으로 옮기지 않는다.
   */
  focusMusic: (musicId: number) => void;
  /** 고스트별을 끈다 (배너의 닫기) */
  dismissGhost: () => void;
  /** 고스트별의 곡이 있는 곳으로 간다 — 레이어 0으로 떠오른 뒤 그 곡을 확대 (MAP-12) */
  surfaceToMusic: (musicId: number) => void;
  /** 내 위치로 가기. 못 갔으면 이유를 돌려준다 (UI 가 안내를 띄운다) */
  goHome: () => GoHomeResult;
  /** 다음 레이어로 파고들기 (게이트가 열려 있을 때만 동작) */
  drillDown: () => void;
  /** 상위 레이어로 떠오르기 */
  surface: () => void;
  /**
   * 지나온 겹 중 하나로 **한 번에** 떠오른다 (S15P21A405-477). 좌상단 브레드크럼이 쓴다 —
   * 한 칸씩(`surface`) 부르면 모프가 비동기라 두 번째 호출이 그냥 씹힌다.
   */
  surfaceTo: (layer: number) => void;
  /** 엔진 → 스토어 동기화 */
  syncFromEngine: (snap: Partial<EngineSnapshot>) => void;
}

export const useMapStore = create<MapState>()(
  devtools(
    (set, get) => ({
      layer: 0,
      boxes: EMPTY_BOXES,
      prefetchBoxes: null,
      camera: { cx: 0, cy: 0, s: 100 },
      residentCount: 0,
      viewportCount: 0,
      zoomK: 1,
      gateOpen: false,
      gateProgress: 0,
      gateAtCount: 0,
      atBottom: false,
      canRise: false,
      pressure: 0,
      pressureDir: 0,
      morph: null,
      myMusicId: null,
      home: null,
      ghostMusicId: null,
      playingElsewhere: false,
      canGoHome: false,

      viewMode: "default",
      nearbyPanelHandled: false,
      selectedMusicId: null,
      nearbyCenterMusicId: null,
      constellationMusicIds: EMPTY_IDS,
      constellationSource: null,
      constellationPoints: EMPTY_POINTS,

      setViewMode: (viewMode) => set({ viewMode }, false, "setViewMode"),
      selectMusic: (selectedMusicId) => set({ selectedMusicId }, false, "selectMusic"),
      setMyMusicId: (myMusicId) => {
        set({ myMusicId }, false, "setMyMusicId");
        getMapEngine()?.setMy(myMusicId);
      },

      // 오버레이 뷰는 하나만 (PATH-01-1) — 주변 탐색을 켜면 별자리가 닫히고, 그 반대도 마찬가지
      enterNearby: (musicId, panelHandled = false) => {
        set(
          {
            viewMode: "nearby",
            nearbyCenterMusicId: musicId,
            selectedMusicId: musicId,
            nearbyPanelHandled: panelHandled,
            constellationMusicIds: EMPTY_IDS,
            constellationPoints: EMPTY_POINTS,
            constellationSource: null,
          },
          false,
          "enterNearby",
        );
      },
      exitNearby: () => set({ viewMode: "default", nearbyCenterMusicId: null, nearbyPanelHandled: false }, false, "exitNearby"),

      showConstellation: (constellationMusicIds, points = EMPTY_POINTS, constellationSource) =>
        set(
          { viewMode: "constellation", constellationMusicIds, constellationPoints: points, constellationSource, nearbyCenterMusicId: null },
          false,
          "showConstellation",
        ),
      setConstellationList: (constellationMusicIds, points = EMPTY_POINTS, constellationSource) =>
        set({ constellationMusicIds, constellationPoints: points, constellationSource }, false, "setConstellationList"),
      toggleConstellationView: () =>
        set(
          (s) =>
            s.viewMode === "constellation"
              ? { viewMode: "default" }
              : { viewMode: "constellation", nearbyCenterMusicId: null },
          false,
          "toggleConstellationView",
        ),
      hideConstellationView: () => set((s) => (s.viewMode === "constellation" ? { viewMode: "default" } : {}), false, "hideConstellationView"),
      clearConstellation: () =>
        set(
          (s) => ({
            viewMode: s.viewMode === "constellation" ? "default" : s.viewMode,
            constellationMusicIds: EMPTY_IDS,
            constellationPoints: EMPTY_POINTS,
            constellationSource: null,
          }),
          false,
          "clearConstellation",
        ),

      focusMusic: (musicId) => {
        const engine = getMapEngine();
        set({ selectedMusicId: musicId }, false, "focusMusic");
        // 이 겹에 있으면 확대, 없으면 "범위 밖에 있다"고 치고 고스트별로 (MAP-12)
        if (engine?.isAlive(musicId)) engine.focusSong(musicId);
        else engine?.setGhost(musicId);
      },
      dismissGhost: () => {
        getMapEngine()?.clearGhost();
        set({ ghostMusicId: null }, false, "dismissGhost");
      },
      surfaceToMusic: (musicId) => {
        set({ selectedMusicId: musicId }, false, "surfaceToMusic");
        getMapEngine()?.surfaceToSong(musicId);
      },
      /**
       * 재생으로 내 위치가 정해졌던 겹·화면으로 돌아간다.
       *
       * **임시 뷰(주변 탐색·별자리)가 떠 있으면 먼저 닫고 간다** (S15P21A405-445). 예전에는 "닫고
       * 눌러 달라" 고 토스트만 띄웠는데, 내 위치는 곧 재생 중인 곡이라 어디서 누르든 거기로 가는
       * 게 맞다. 엔진 쪽 뷰를 여기서 직접 내린다 — 스토어만 바꾸면 효과가 도는 다음 렌더까지
       * 엔진은 아직 뷰가 떠 있다고 보고 "overlay" 를 돌려준다.
       */
      goHome: () => {
        const engine = getMapEngine();
        if (!engine) return "none";
        const { viewMode } = get();
        if (viewMode === "nearby") {
          engine.exitProbe();
          get().exitNearby();
        } else if (viewMode === "constellation") {
          engine.exitConstellation();
          get().hideConstellationView();
        }
        return engine.goHome();
      },
      drillDown: () => getMapEngine()?.descend(),
      surface: () => getMapEngine()?.ascend(),
      surfaceTo: (layer) => getMapEngine()?.ascendTo(layer),

      syncFromEngine: (snap) => set(snap, false, "syncFromEngine"),
    }),
    { name: "map-store" },
  ),
);

/** 별자리 뷰가 열려 있는가 (PATH-01) */
export const isConstellationOpen = (s: MapState) => s.viewMode === "constellation" && s.constellationMusicIds.length >= 2;
