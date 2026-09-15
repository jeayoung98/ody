import { axisLine, CONSTELLATION, DRILL, FOCUS, FOLLOW, GHOST, HOLD, ME_FLIGHT, ME_OFFSCREEN, LAYER_COUNT, LAYER_NAMES, MAP_FRIENDS_MAX, OCCLUSION_EASE, OVERLAY_ZOOM, PAN_LIMIT, PROBE, REPRESENTATIVE_GRID_PX, STAR_VIEW, WHEEL_ZOOM } from "@/constants";
import type { EngineSnapshot } from "@/stores/use-map-store";
import type { ConstellationPoint, LayerBox, MapCamera, MapPoint, NearbyUser } from "@/types";
import { ro } from "@/lib/korean";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameMask = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
let warnedNaN = false;
const sameBoxes = (a: readonly LayerBox[], b: readonly LayerBox[]) =>
  a.length === b.length && a.every((x, i) => x.layer === b[i].layer && x.xMin === b[i].xMin && x.xMax === b[i].xMax && x.yMin === b[i].yMin && x.yMax === b[i].yMax);
/** 화면 좌표 단위벡터. 길이가 0이면 방향이 없다는 뜻이라 null */
const unit = (x: number, y: number) => {
  const d = Math.hypot(x, y);
  return d < 1e-6 ? null : { x: x / d, y: y / d };
};
/** 인덱스 버퍼를 새 크기로. 앞쪽 keep 칸은 그대로 옮기고 뒤는 0 (곡은 뒤에 이어붙기만 한다) */
const growF = (a: Float32Array, n: number, keep: number) => {
  const b = new Float32Array(n);
  if (keep > 0) b.set(a.subarray(0, Math.min(keep, a.length, n)));
  return b;
};
const growU = (a: Uint8Array<ArrayBufferLike>, n: number) => {
  const b = new Uint8Array(n);
  b.set(a.subarray(0, Math.min(a.length, n)));
  return b;
};

/**
 * "내 위치로 가기" 결과. 안 움직였으면 **왜** 안 움직였는지 UI 가 알려 줄 수 있어야 한다 —
 * 눌렀는데 아무 일도 안 나는 게 제일 나쁘다.
 */
export type GoHomeResult = "moved" | "queued" | "overlay" | "follow" | "none";

interface Frame {
  layer: number;
  cam: MapCamera;
  subset: Uint8Array<ArrayBufferLike>;
  /**
   * 그 겹에 **들어왔을 때의 배율**. 줌 한계와 게이트가 전부 이 값 기준이라 떠오를 때 되살려야 한다.
   * 카메라(`cam`)는 떠날 때 확대돼 있던 값이라 이걸 대신 쓸 수 없다 (S15P21A405-271).
   */
  entryS: number;
}

interface Morph {
  t0: number;
  layer: number;
  cam: MapCamera;
  subset: Uint8Array<ArrayBufferLike>;
  big: string;
  sub: string;
  /** 1 = 파고들기(확대해 들어간다), -1 = 떠오르기(물러난다) */
  dir: 1 | -1;
  /** 도착한 겹의 진입 배율. 없으면 도착 카메라 배율을 쓴다 (파고들 때는 그게 맞다) */
  entryS?: number;
  /**
   * dive = 교차 확대(겹을 옮긴다). fade = 같은 자리에서 집합만 바꾸는 교차 페이드 —
   * 전환이 끝난 뒤 겹 응답이 도착해 임시 집합을 실제 집합으로 바꿀 때 쓴다 (S15P21A405-284)
   */
  mode: "dive" | "fade";
}

/** 주변 탐색의 고리 하나 — 중심 곡과 그 이웃. `ax/ay` 는 오버레이 공간에서의 중심 자리 */
export interface ProbeRing {
  centerId: number;
  ids: number[];
  t0: number;
  /** 오버레이 공간에서의 중심 자리 (목표). 밀려나는 중이면 `fx/fy` 에서 여기로 미끄러진다 */
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  /**
   * 지금 고리에서 물러난 시각. 그때부터 자기 중심으로 오므라들어(prevScale) 작은 뭉치가 되고
   * 새 중심 반대편으로 밀려난다(prevDist) — 새 고리와 겹치지 않게 (S15P21A405-285)
   */
  demotedAt: number | null;
  /** 건너가기로 생긴 고리 — 이웃이 지도 자리에서 날아오지 않고 **중심에서 펼쳐져** 나온다 */
  unfold: boolean;
  /** 밀려나 사라지기 시작한 시각 (고리 수 한도를 넘었을 때) */
  leavingAt: number | null;
}

/** 화면에 잡힌 친구 (그리기·히트테스트용) */
export interface VisibleFriend {
  user: NearbyUser;
  px: number;
  py: number;
  /** 진행 방향(rad). 우주선 기수 */
  heading: number;
  isLeader: boolean;
}

export interface VisibleStar {
  i: number;
  px: number;
  py: number;
  r: number;
}

/**
 * 따라가기 상태 (SOCIAL-07). 인솔자의 동작은 두 단계로 나뉘어 전달된다.
 *  ① 인솔자가 곡을 클릭해 상세를 본다 → viewingMusicId 변경 → **내 뷰가 먼저 그리로 간다** (우주선은 제자리)
 *  ② 인솔자가 그 곡을 재생한다 → 우주선이 이전 재생 곡에서 날아온다. **이때 뷰는 움직이지 않는다**
 * 인솔자가 레이어를 바꾸면 따라가는 사람도 같은 레이어로 전환된다.
 */
export interface FollowState {
  leader: NearbyUser;
  /** 인솔자가 지금 보고 있는 상세 곡 (뷰포트·우측 패널 기준) */
  viewingMusicId: number;
  /** 인솔자가 지금 재생 중인 곡 (우주선 위치 기준) */
  playingMusicId: number;
  /** 다음에 일어날 인솔자 동작 */
  phase: "view" | "play";
  /** 그 동작이 일어날 시각 */
  nextAt: number;
  hops: number;
  /** 우주선 이동 구간 (월드 좌표). 이 동안 카메라는 고정 */
  mv: { ax: number; ay: number; bx: number; by: number; cx: number; cy: number; t0: number; dur: number; toId: number } | null;
  /** 방문한 곡 (하차 시 저장 대기) */
  visited: number[];
}

/**
 * 지도 엔진 — 좌표·카메라·레이어(재투영)·모프·따라가기·친구 배치를 한 곳에서 다룬다.
 * React 는 프레임마다 스냅샷만 받고, 그리기는 draw-map 이 이 객체를 읽어 수행한다.
 *
 * 탐색 규칙 (모프 프로토타입):
 *  - 휠 확대 = 순수 확대. 화면 중앙 보이지 않는 구멍 안 곡 수가 GATE 이하가 되면 확대가 멈추고(벽) 압력만 찬다.
 *  - 압력이 차면 구멍 안 곡만 다음 레이어(다음 PC 두 축)로 재투영되어 새 자리로 이동하고, 나머지는 바깥으로 밀려나 사라진다.
 *  - 들어온 배율보다 더 축소하면 떠오르기 압력이 차고, 두고 온 곡이 바깥에서 돌아오며 좌표가 복원된다.
 */
export class MapEngine {
  songs: MapPoint[] = [];
  private index = new Map<number, number>();
  private byWeight: number[] = [];
  /** 별마다 다른 깊이 (가우시안). 시차에 쓴다 — 팬·줌에 따라 앞뒤가 갈린다 (프로토타입 z) */
  z = new Float32Array(0);
  /** 화면 안에 들어와 있는 상주 곡 수 — 다음 단계로 데려갈 후보다. 프레임마다 갱신 */
  viewportCount = 0;
  /**
   * 이 겹 별들을 다 감싸는 반지름 (중심 기준 px). 고스트별과 화면 밖 '나' 표식을 그 밖에 놓는다.
   * 프레임마다 갱신한다 — 둘 다 매 프레임 자리를 다시 잡아야 해서 조건부로 재 두면 한 박자 늦는다.
   */
  private cloudExtent = 0;
  N = 0;

  W = 1;
  H = 1;
  occludedRight = 76;
  /**
   * 지도 위에 떠 있는 HUD 상자들 (화면 좌표). 화면 밖 표식을 여기에 가리지 않게 놓는다.
   * 상수로 박지 않고 **실제 DOM 을 재서** 받는다 — 패널이 열리고 닫히면 달라지기 때문이다.
   */
  private obstacles: { x0: number; y0: number; x1: number; y1: number }[] = [];
  /** 패널이 열리고 닫히면 여기가 먼저 바뀌고 occludedRight 가 프레임마다 따라간다 */
  private occludedTarget = 76;

  layer = 0;
  cam: MapCamera = { cx: 0, cy: 0, s: 100 };
  /** 부드럽게 따라갈 카메라 목표 (focus/travel/follow 때만 사용) */
  private camTarget: MapCamera | null = null;
  private entryS = 100;

  subset: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private stack: Frame[] = [];
  /**
   * 겹마다 화면으로 좁혀 온 범위 (boxes[l] = 레이어 l 에서 담았던 사각형).
   * 파고들 때 쌓고 떠오르면 그 아래를 버린다 — 이 누적이 다음 겹 요청의 조건이 된다.
   * 길이 = 지금(또는 곧 도착할) 레이어 번호라, 서버 level 은 boxes.length + 1 이다.
   */
  boxes: readonly LayerBox[] = [];
  pos = new Float32Array(0);
  private from = new Float32Array(0);
  private to = new Float32Array(0);
  alpha = new Float32Array(0);
  /** 전환 중 **나가는 겹**의 화면 좌표·투명도 (들어오는 겹은 pos/alpha) */
  posOut = new Float32Array(0);
  alphaOut = new Float32Array(0);
  /** 전환 진행도(이징 적용, 0 = 이전 겹 / 1 = 새 겹). 배경 깊이처럼 겹 단위 값을 섞을 때 쓴다 */
  morphT = 0;
  private aFrom = new Float32Array(0);
  private aTo = new Float32Array(0);
  anim: Morph | null = null;
  /**
   * 압력이 차는 동안 미리 정해 둔 다음 겹 요청 범위 (`boxes` + 다음 상자). 화면이 그 키로 곡을
   * **미리 받아** 두면 파고든 순간 실제 집합이 이미 있어 임시 집합 → 실제 집합 교체가 안 보인다 (S15P21A405-284).
   * 압력이 빠지거나 카메라가 움직이면 버린다 — 상자는 그 순간 화면에서 나오기 때문이다
   */
  prefetch: readonly LayerBox[] | null = null;
  /** 화면이 `prefetch` 키로 미리 받아 넘겨준 다음 겹 집합. 키가 같을 때만 쓴다 */
  private prefetched: { boxes: readonly LayerBox[]; songs: MapPoint[] } | null = null;
  /**
   * 파고들기 대기. **실제 집합이 온 뒤에 출발한다** — 임시 집합으로 먼저 출발하고 도중에 갈아 끼우면
   * 들어오는 별의 자리가 통째로 바뀌어 뚝 튄다 (S15P21A405-284). 너무 오래 걸리면 임시 집합으로 간다
   */
  private pending: { box: LayerBox; inView: number; since: number; s0: number } | null = null;

  pressure = 0;
  pressureDir: 1 | -1 | 0 = 0;

  myId: number | null = null;
  /** 내 위치 (월드, 현재 레이어). 재생 시 곡 쪽으로 이동한다 */
  me = { x: 0, y: 0 };
  private travelToId: number | null = null;
  /**
   * '나'의 비행 (MAP-08). 재생을 누르면 있던 자리에서 그 곡으로 곡선을 타고 날아간다.
   * a = 출발, b = 도착, c = 곡선 제어점, t0 = 시작 시각
   */
  meFlight: { ax: number; ay: number; bx: number; by: number; cx: number; cy: number; t0: number } | null = null;
  /**
   * 주변 탐색 고리 **안에서의** 이동 — 정찰 (S15P21A405-288). 고리 곡은 실제 좌표가 아니라 연출 자리에
   * 그려지므로 월드 비행(meFlight)으로는 못 간다. 출발한 **화면 자리**만 적어 두고 도착 자리는 매 프레임
   * probePos 로 다시 잰다 (고리가 밀리거나 드래그돼도 우주선이 별에서 떨어지지 않게)
   */
  meHop: { x: number; y: number; t0: number } | null = null;
  /**
   * 주변 탐색 중 선택한 이웃 라벨 밑의 "주변 보기 ›" 링크 히트 영역 (S15P21A405-288).
   * 그리는 쪽(drawProbe)이 매 프레임 채우고, 없으면 null — 글씨가 있는 곳이 곧 누를 수 있는 곳이어야 한다
   */
  hopLink: { id: number; x: number; y: number; w: number; h: number } | null = null;
  /** 별을 꾹 누르는 중 — 링이 차오른다. 다 차면 그 별 주변으로 파고든다 (S15P21A405-288) */
  hold: { id: number; t0: number } | null = null;
  /** 지금 재생 중인 곡. 이 겹에 없어도 기억해 둔다 (표식에 상태를 싣기 위해, MAP-08) */
  playingId: number | null = null;
  /**
   * "내 위치로 가기" 로 돌아갈 자리 — 재생으로 내 위치가 정해진 **그때의 겹**이다.
   * 겹 이동은 서버 상태 없이 누적 범위를 매번 다시 보내는 구조라, `boxes` 만 들고 있으면
   * 같은 곡 집합을 다시 받을 수 있다. 카메라는 돌아갈 때 곡 좌표로 다시 계산한다.
   */
  home: { musicId: number; boxes: readonly LayerBox[] } | null = null;
  /**
   * 겹 전환이 끝나면 이 곡을 가운데로 다시 맞춘다.
   * 전환 중에 상주 집합 응답이 오면 `setLayerSongs` 가 목표 카메라를 `fitCam` 으로 다시 계산해
   * 가운데 맞춤이 덮인다 — 마지막에 한 번 더 잡아 준다.
   */
  private centerAfterMorph: number | null = null;
  /**
   * '나'를 화면 가운데 붙들어 둔다.
   *
   * 재생하거나 "내 위치로 가기" 로 가운데에 맞춘 순간 켜지고, **사용자가 직접 밀거나 확대하면 꺼진다.**
   * 켜져 있는 동안은 우측 패널이 열리고 닫혀 **지도가 보이는 영역이 달라져도** 그 가운데를 따라간다 —
   * 상세가 열리면 왼쪽으로 치우친 가운데, 닫으면 화면 가운데로 부드럽게 돌아온다.
   */
  private centerLock = false;
  /** 겹 전환 중에 "내 위치로 가기" 를 누르면 전환이 끝난 뒤 처리한다 */
  private pendingHome = false;

  selectedId: number | null = null;
  hoverId: number | null = null;
  nearby: { centerId: number; ids: number[] } | null = null;
  /** 주변 탐색 연출 상태. back = 진입 전 카메라 */
  /**
   * 주변 탐색 뷰 (MAP-10). 고리(중심 + 이웃 10곡)를 최대 `PROBE.maxRings` 개 이어 붙인다 (S15P21A405-285).
   * 고리 자리는 **오버레이 공간**(첫 고리 중심 = 원점)에 두고, `off` + `pan` 으로 화면에 옮긴다 —
   * 새 중심이 화면 가운데로 오도록 `off` 가 움직이고, 드래그는 `pan` 에 쌓인다
   */
  probe: {
    rings: ProbeRing[];
    exitingAt: number | null;
    back: MapCamera;
    offFrom: { x: number; y: number };
    offTo: { x: number; y: number };
    offT0: number;
    pan: { x: number; y: number };
  } | null = null;
  /** 별자리 뷰 곡 ID (순서 = 경로 순서) */
  route: number[] = [];
  /** 별자리 뷰 안에서의 이동·확대. 지도 카메라와 별개다 (오버레이는 화면 좌표 배치) */
  overlay = { zoom: 1, dx: 0, dy: 0 };
  /** 다가가는 중인 별자리 곡. 좌표가 아니라 ID 다 — {@link overlayFocus} 참고 */
  private overlayFocusId: number | null = null;
  private overlayFocusZoom = 1;
  /** 상주 별들이 차지하는 월드 범위. 카메라를 이 근처에 붙잡아 둔다 */
  private bbox = { x0: -1, x1: 1, y0: -1, y1: 1 };
  /** 별자리 오버레이 뷰 상태. layout = 백엔드가 준 16차원 압축 2D 고정 배치 (PATH-01) */
  constellation: { ids: number[]; layout: ConstellationPoint[]; box: { x0: number; x1: number; y0: number; y1: number }; t0: number; exitingAt: number | null } | null = null;
  /** 이 겹에 없는 곡을 "범위 밖에 있다"고 치고 띄우는 유령 별 (MAP-12). 검색에서만 만든다 */
  ghost: { musicId: number; t0: number } | null = null;

  friends: NearbyUser[] = [];
  private friendsLayer = -1;
  private friendPos = new Map<string, { x: number; y: number; heading: number }>();
  private anchorCache = new Map<string, number>();
  private aliveIdx: number[] = [];
  visFriends: VisibleFriend[] = [];
  /** 이 레이어의 대표곡 (커버) */
  repIds = new Set<number>();
  private repLayer = -1;
  /** 레이어 전환 시 커버·프로필 페이드. 모프 중 0으로, 새 레이어 데이터가 오면 1로 */
  coverAlpha = 0;
  friendAlpha = 0;
  follow: FollowState | null = null;
  onFollowEnd: ((reason: string) => void) | null = null;
  onArrive: ((musicId: number) => void) | null = null;
  /** 인솔자가 보고 있는 곡이 바뀌면 알린다 (우측 패널에 상세를 띄우기 위해) */
  onLeaderViewingChange: ((musicId: number) => void) | null = null;

  visible: VisibleStar[] = [];
  chosen = new Set<number>();
  time = 0;
  private lastSnap: Partial<EngineSnapshot> = {};
  private snapListener: ((s: Partial<EngineSnapshot>) => void) | null = null;
  private inited = false;
  /** 사용자가 확대/이동했는지. 전까지는 크기가 바뀌면 카메라를 다시 맞춘다 (자가치유) */
  private touched = false;

  // ------------------------------------------------------------------ setup
  setSnapshotListener(fn: (s: Partial<EngineSnapshot>) => void) {
    this.snapListener = fn;
  }

  setSize(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    // 캔버스 크기가 잡히기 전(1x1)에 계산된 카메라는 배율이 엉뚱하므로 무조건 다시 맞춘다
    const wasUnsized = this.W < 50 || this.H < 50;
    this.W = Math.max(1, W);
    this.H = Math.max(1, H);
    if (!this.inited || this.anim) return;
    if ((wasUnsized || !this.touched) && this.myId != null) {
      this.cam = this.fitCam(this.layer, this.subset, this.fitAnchor(this.subset, this.layer));
      this.entryS = this.cam.s;
    }
    this.project();
  }

  /**
   * 우측 패널 폭 변화. 값을 바로 갈아끼우면 freeRect 를 쓰는 것들(별자리 배치·주변 탐색 고리)이
   * 한 프레임에 순간이동한다 — 목표만 잡아두고 frame() 에서 따라가게 한다.
   */
  setOcclusion(right: number) {
    this.occludedTarget = right;
    // 첫 설정은 애니메이션 없이 바로
    if (!this.inited) this.occludedRight = right;
  }

  /**
   * 곡 배열을 갈아끼우고 인덱스 기반 버퍼를 새 크기로 잡는다.
   * 호출은 두 가지뿐이다 — 첫 진입(keep=0) 과 **뒤에 이어붙이기**(앞쪽 인덱스 유지).
   * 그래서 이미 화면에 있던 별의 좌표·투명도는 그대로 남고, 새 곡만 0 에서 시작한다.
   */
  private allocate(songs: MapPoint[], keep: number) {
    this.songs = songs;
    this.N = songs.length;
    this.index = new Map(songs.map((s, i) => [s.musicId, i]));
    this.byWeight = songs.map((_, i) => i).sort((a, b) => songs[b].weight - songs[a].weight);
    // 깊이는 musicId 로 결정한다 (새로고침해도 같은 하늘)
    this.z = growF(this.z, this.N, keep);
    for (let i = keep; i < this.N; i++) {
      let h = (songs[i].musicId * 2654435761) >>> 0;
      let g = 0;
      for (let k = 0; k < 4; k++) {
        h = (h * 1664525 + 1013904223) >>> 0;
        g += h / 0xffffffff;
      }
      this.z[i] = ((g - 2) / 1.6) * 0.75;
    }
    this.pos = growF(this.pos, this.N * 2, keep * 2);
    this.from = growF(this.from, this.N * 2, keep * 2);
    this.to = growF(this.to, this.N * 2, keep * 2);
    this.posOut = growF(this.posOut, this.N * 2, keep * 2);
    this.alphaOut = growF(this.alphaOut, this.N, keep);
    this.alpha = growF(this.alpha, this.N, keep);
    this.aFrom = growF(this.aFrom, this.N, keep);
    this.aTo = growF(this.aTo, this.N, keep);
    // 상주 마스크는 인덱스 기반이라 쌓아둔 겹들 것까지 함께 늘린다
    this.subset = growU(this.subset, this.N);
    for (const f of this.stack) f.subset = growU(f.subset, this.N);
    if (this.anim) this.anim.subset = growU(this.anim.subset, this.N);
  }

  /** 첫 진입 — 레이어 0(전 우주)의 상주 집합 */
  setSongs(songs: MapPoint[]) {
    this.allocate(songs, 0);
    this.subset = this.residentMask();
    this.alpha.set(this.subset);
    this.stack = [];
    this.boxes = [];
    this.layer = 0;
    /**
     * **없으면 비워 둔다.** 예전에는 아무 곡이나(`centerMost`) 내 자리로 잡았는데, 그러면 한 번도
     * 재생한 적 없는 사람에게도 엉뚱한 곳에 '나' 가 떴다. 내 자리는 **곡을 재생해야 생긴다**
     * (S15P21A405-275). 카메라 맞춤은 `fitAnchor` 가 대신 기준점을 찾는다.
     */
    if (this.myId != null && !this.index.has(this.myId)) this.myId = null;
    const anchor = this.fitAnchor(this.subset, 0);
    if (this.myId != null) {
      const m = this.songs[this.index.get(this.myId)!];
      this.me = { x: m.pc[0], y: m.pc[1] };
    }
    this.cam = this.fitCam(0, this.subset, anchor);
    this.entryS = this.cam.s;
    this.inited = true;
    this.rebuildAliveIdx();
    this.project();
  }

  /**
   * 이 겹의 상주 집합이 도착했다 (겹마다 서버에서 받는다 — BACKEND-NOTES A-1).
   * 못 보던 곡은 배열 뒤에 이어붙이고, 상주 마스크를 받은 집합으로 갈아끼운다.
   * 파고드는 전환 중에 도착하면 그 전환의 **도착 지점만** 바뀌어 한 번의 연출로 끝난다.
   */
  setLayerSongs(layer: number, songs: MapPoint[]) {
    if (!this.inited) {
      this.setSongs(songs);
      return;
    }
    // 지나간 겹의 응답 (전환 중이면 도착할 겹이 기준)
    if (layer !== (this.anim?.layer ?? this.layer)) return;
    const ns = this.maskFor(layer, songs);
    // 이미 그 집합이면 다시 연출하지 않는다 (떠오르기는 쌓아둔 집합으로 이미 돌아가 있다)
    if (sameMask(this.anim?.subset ?? this.subset, ns)) return;
    // 전환 중이면 목적지만 바꿔 끼운다 — 다시 시작하면 전환이 두 번 보인다 (S15P21A405-284)
    if (this.anim) {
      this.retarget(this.fitCam(layer, ns, this.fitAnchor(ns, layer)), ns);
      return;
    }
    // 전환이 끝난 뒤 도착한 응답: 같은 자리에서 집합만 교차 페이드한다. 다이빙을 다시 하지 않는다
    const axes = axisLine(layer);
    this.morph(
      layer,
      { ...this.cam },
      ns,
      `${LAYER_NAMES[layer]} — 상주 ${songs.length.toLocaleString()}곡`,
      axes,
      1,
      this.entryS,
      "fade",
    );
  }

  /**
   * 겹 맞춤(`fitCam`)의 기준 곡.
   *
   * 내 곡이 이 겹에 상주하지 않으면 가장 가까운 상주 곡을 대신 쓴다. **`myId` 는 건드리지 않는다** —
   * '나' 는 내가 재생한 그 곡이고, 여기서 옮겨 두면 되돌아오지 않아서 "내 위치로 가기" 가
   * 남의 곡 자리로 간다.
   */
  private fitAnchor(mask: Uint8Array, layer: number) {
    // 내 자리가 아직 없을 수 있다 (한 번도 재생 안 한 사람). 그때는 무리 한가운데를 기준으로 본다
    const id = this.myId ?? this.centerMost();
    const i = this.index.get(id);
    if (i == null) return this.centerMost();
    return mask[i] ? id : this.nearestIn(mask, id, layer);
  }

  /** 마스크 안에서 기준 곡과 가장 가까운 곡 (그 겹 두 축 기준) */
  private nearestIn(mask: Uint8Array, fromId: number, layer: number) {
    const c = this.songs[this.index.get(fromId)!];
    const dx = layer * 2;
    const dy = dx + 1;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.N; i++) {
      if (!mask[i]) continue;
      const d = (this.songs[i].pc[dx] - c.pc[dx]) ** 2 + (this.songs[i].pc[dy] - c.pc[dy]) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best >= 0 ? this.songs[best].musicId : fromId;
  }

  /** 곡 데이터가 들어와 엔진이 살아 있는가 */
  get ready() {
    return this.inited;
  }

  /** 초기 내 곡 (setSongs 전에 호출). 데이터가 오면 그 자리에서 시작한다 */
  setInitialMy(id: number | null) {
    this.myId = id;
  }

  /**
   * 새로고침 복원 — 저장해 둔 "돌아갈 자리" 를 되살린다 (S15P21A405-275).
   * 첫 진입에만 부른다. 이미 재생해서 자리가 생겼으면 덮지 않는다.
   */
  restoreHome(home: { musicId: number; boxes: readonly LayerBox[] } | null) {
    if (home && this.home == null) this.home = home;
  }

  setHover(id: number | null) {
    this.hoverId = id;
  }

  /**
   * 호버 카드가 매 프레임 따라붙을 화면 좌표. 카드는 캔버스가 아니라 **DOM** 이라
   * (S15P21A405-277 — 카드 위에 마우스를 올려도 사라지지 않아야 하고 진짜 버튼이 들어간다)
   * 별의 지금 자리를 밖에서 물어볼 수 있어야 한다. 화면에서 빠진 곡이면 null 이다.
   */
  hoverAnchor(): { px: number; py: number } | null {
    if (this.hoverId == null) return null;
    const v = this.visible.find((x) => this.songs[x.i].musicId === this.hoverId);
    return v ? { px: v.px, py: v.py } : null;
  }

  setSelected(id: number | null) {
    // 고스트별로 띄운 곡이 아닌 다른 곡을 고르면 고스트는 사라진다 (MAP-12)
    if (this.ghost && id !== this.ghost.musicId) this.ghost = null;
    this.selectedId = id;
  }

  setCallbacks(cb: {
    onFollowEnd?: (reason: string) => void;
    onArrive?: (musicId: number) => void;
    onLeaderViewingChange?: (musicId: number) => void;
  }) {
    this.onFollowEnd = cb.onFollowEnd ?? null;
    this.onArrive = cb.onArrive ?? null;
    this.onLeaderViewingChange = cb.onLeaderViewingChange ?? null;
  }

  /** 이 레이어(영역)의 주변 사용자. 레이어가 바뀌면 새 목록이 페이드인된다 */
  setFriends(layer: number, friends: NearbyUser[]) {
    this.friends = friends;
    this.friendsLayer = layer;
    this.friendPos.clear();
    this.anchorCache.clear();
  }

  /** 이 레이어의 대표곡 ID (앨범 커버로 띄우는 곡). 레이어마다 다르다 */
  setRepresentatives(layer: number, ids: number[]) {
    this.repIds = new Set(ids);
    this.repLayer = layer;
  }

  /**
   * 목 폴백: 사용자의 곡이 이 레이어 상주 집합에 없으면 이메일 해시로 상주 곡 하나를 정해 그 자리에 둔다.
   * 실서비스는 백엔드가 현재 영역의 사용자만 내려주므로 필요 없다.
   */
  private anchorFor(u: NearbyUser): { x: number; y: number } | null {
    if (this.isAlive(u.musicId)) return this.worldOf(u.musicId);
    let idx = this.anchorCache.get(u.email);
    if (idx == null) {
      if (!this.aliveIdx.length) return null;
      let h = 2166136261;
      for (const ch of u.email) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
      idx = this.aliveIdx[h % this.aliveIdx.length];
      this.anchorCache.set(u.email, idx);
    }
    const s = this.songs[idx];
    return { x: s.pc[this.dx()], y: s.pc[this.dy()] };
  }

  private rebuildAliveIdx() {
    this.aliveIdx = [];
    for (let i = 0; i < this.N; i++) if (this.subset[i]) this.aliveIdx.push(i);
    this.anchorCache.clear();
    this.computeBbox();
  }

  /** 지금 겹 축에서 상주 별들이 차지하는 범위 */
  private computeBbox() {
    const dx = this.dx();
    const dy = this.dy();
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < this.N; i++) {
      if (!this.subset[i]) continue;
      const x = this.songs[i].pc[dx];
      const y = this.songs[i].pc[dy];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    this.bbox = Number.isFinite(x0) ? { x0, x1, y0, y1 } : { x0: -1, x1: 1, y0: -1, y1: 1 };
  }

  /**
   * 카메라를 별 무리 근처에 붙잡아 둔다 — 한 방향으로 무한히 밀어서 별이 전부
   * 화면에서 사라지는 걸 막는다. 화면 반쪽의 PAN_LIMIT.slack 만큼까지만 더 나간다.
   */
  private clampCam() {
    const f = this.freeRect();
    const mx = (((f.x1 - f.x0) / 2) * PAN_LIMIT.slack) / this.cam.s;
    const my = (((f.y1 - f.y0) / 2) * PAN_LIMIT.slack) / this.cam.s;
    this.cam.cx = Math.min(Math.max(this.cam.cx, this.bbox.x0 - mx), this.bbox.x1 + mx);
    this.cam.cy = Math.min(Math.max(this.cam.cy, this.bbox.y0 - my), this.bbox.y1 + my);
  }

  // ------------------------------------------------------------------ 오버레이(별자리) 조작
  /** 별자리 뷰에 들어갈 때 초기화 */
  overlayReset() {
    this.overlay = { zoom: 1, dx: 0, dy: 0 };
    this.overlayFocusId = null;
  }

  overlayPan(dx: number, dy: number) {
    this.overlayFocusId = null;
    this.overlay.dx += dx;
    this.overlay.dy += dy;
    this.clampOverlay();
  }

  /**
   * 별자리 뷰에서 **그 곡으로 다가간다** (S15P21A405-330) — 배치 영역 한복판에 놓고 확대한다.
   *
   * 배치 안의 곡을 눌렀는데 화면이 안 움직이면 "눌렸나?" 가 된다. 지도 본체에서는 `viewSong`
   * 이 맡는 일인데, 별자리는 카메라가 아니라 오버레이 변환으로 그려지므로 여기가 그 자리다.
   *
   * **목표를 좌표가 아니라 곡 ID 로 들고 있는다.** 클릭과 동시에 우측 패널이 열려 배치 영역이
   * 좁아지고 `constellationFit` 이 다시 잡히는데, 그 변화는 다음 프레임에야 반영된다 —
   * 좌표로 굳혀 두면 좁아진 화면에서 엉뚱한 자리로 간다. 매 프레임 다시 계산하면 영역이
   * 어떻게 변하든 그 곡이 한복판으로 온다.
   */
  overlayFocus(id: number) {
    const c = this.constellation;
    if (!c || c.exitingAt || !c.layout.some((q) => q.musicId === id)) return;
    this.overlayFocusId = id;
    // 이미 더 확대해 둔 상태면 끌어내리지 않는다 — 들여다보던 배율을 빼앗는 꼴이다
    this.overlayFocusZoom = Math.min(OVERLAY_ZOOM.max, Math.max(this.overlay.zoom, CONSTELLATION.focusZoom));
  }

  /** 그 곡을 한복판에 놓으려면 오버레이가 어디에 있어야 하나 (지금 영역·목표 배율 기준) */
  private overlayDest(id: number, zoom: number) {
    const p = this.constellation?.layout.find((q) => q.musicId === id);
    if (!p) return null;
    const fit = this.constellationFit();
    // `constellationPos` 의 역산이다: tx = cx + (p.x-bx)·s·zoom + dx 를 cx 에 놓는 dx
    return { dx: -(p.x - fit.bx) * fit.s * zoom, dy: (p.y - fit.by) * fit.s * zoom };
  }

  /**
   * 영역 한복판을 붙잡은 채 확대 (S15P21A405-306).
   *
   * 예전에는 **커서 아래 지점**을 붙잡았다. 지도 본체에서는 그게 맞지만 별자리 영역은 우측
   * 패널을 뺀 좁은 띠라, 커서가 위아래 끝에 있으면 4배로 키우는 순간 별자리가 통째로 띠 밖으로
   * 밀려났다 — 확대했더니 아무것도 안 보이고, 다시 찾으려면 두 축을 다 더듬어야 했다.
   *
   * 한복판을 붙잡으면 확대해도 보고 있던 자리가 그대로 있고, 거기서 끌어 끝 별로 가면 된다.
   */
  overlayWheel(deltaY: number) {
    this.overlayFocusId = null;
    const o = this.overlay;
    const next = Math.min(OVERLAY_ZOOM.max, Math.max(OVERLAY_ZOOM.min, o.zoom * Math.exp(-deltaY * WHEEL_ZOOM)));
    // 한복판 고정 = 지금 한복판에 있는 배치 지점이 그대로 한복판에 남는다
    const k = next / o.zoom;
    o.zoom = next;
    o.dx *= k;
    o.dy *= k;
    this.clampOverlay();
  }

  /**
   * 밀 수 있는 한계 (S15P21A405-306).
   *
   * 기준은 **"가장 바깥 곡을 영역 한복판까지 끌어올 수 있어야 한다"** 다. 그래서 한계를
   * 화면 크기가 아니라 **배치가 실제로 뻗은 거리**에서 뽑는다 — 그 거리는 확대하면 같이 커지므로
   * 배율이 몇이든 끝 별에 손이 닿는다. 거기에 기존 여유(`slack`)를 더해 조금 더 밀리게 둔다.
   *
   * 예전에는 영역 반쪽의 고정 비율만 썼다. 우측 패널이 열려 영역이 가로 300px 로 좁아지면
   * 한계가 67px 이라, 4배로 확대해 폭 1100px 이 된 배치의 끝 별에는 닿을 수가 없었다.
   *
   * 한계 끝까지 밀어도 바깥 곡은 중심에서 `slack` 만큼만 벗어나므로 **별자리가 화면 밖으로
   * 통째로 나가지는 않는다** — 원래 지키려던 성질은 그대로다.
   */
  private clampOverlay() {
    const f = this.constellationRect();
    const b = this.constellation?.box;
    const fit = this.constellationFit();
    const o = this.overlay;
    // 배치 중심에서 가장 먼 곡까지의 거리 (화면 px)
    const ex = b ? ((b.x1 - b.x0) / 2) * fit.s * o.zoom : 0;
    const ey = b ? ((b.y1 - b.y0) / 2) * fit.s * o.zoom : 0;
    const lx = ex + ((f.x1 - f.x0) / 2) * PAN_LIMIT.slack;
    const ly = ey + ((f.y1 - f.y0) / 2) * PAN_LIMIT.slack;
    o.dx = Math.min(Math.max(o.dx, -lx), lx);
    o.dy = Math.min(Math.max(o.dy, -ly), ly);
  }

  /**
   * 주변 탐색(프로브) 진입 — 연출용 뷰.
   * 기준 곡을 남은 화면 중앙에 두고 유사곡 10곡을 두 겹 고리로 보기 좋게 배치한다 (실제 좌표 아님).
   * 카메라는 기준 곡으로 줌인되고, 곡들은 실제 위치에서 배치 위치로 미끄러져 들어온다.
   */
  /**
   * 주변 탐색 진입 (MAP-10).
   *
   * **ID 가 아니라 곡을 통째로 받는다.** 이웃 10곡은 지도 상주 집합과 **별개 집합**이라
   * (662만 곡 중 16차원상 가까운 10곡) 지도 목록에서 좌표를 찾을 수 없다 — 실측상 겹치는 곡이 0개다.
   * 백엔드가 `pc[16]` 을 이미 주므로 그걸 받아 엔진에 편입한다 ({@link adopt}).
   */
  enterProbe(center: MapPoint, neighbors: MapPoint[]) {
    this.adopt([center, ...neighbors]);
    const centerId = center.musicId;
    const ids = neighbors.map((n) => n.musicId);
    const now = performance.now();
    const p = this.probe;
    if (p && !p.exitingAt) {
      const cur = this.currentRing();
      if (cur && cur.centerId === centerId) {
        cur.ids = ids;
        this.nearby = { centerId, ids };
        return;
      }
      // 건너가기 — 새 중심은 **지금 그 별이 있는 자리**에서 자라난다. 그래야 누른 별이 그대로 중심이 된다.
      // 어느 고리에도 없는 곡(패널에서 고른 곡 등)이면 지금 중심 자리에서 시작한다
      const at = this.overlayPosOf(centerId) ?? (cur ? { x: cur.ax, y: cur.ay } : { x: 0, y: 0 });
      if (cur) {
        // 이전 고리는 자기 중심으로 오므라들며 새 중심 반대편으로 밀려난다 — 어디서 왔는지는 남고, 겹치지는 않는다
        const dx = cur.ax - at.x;
        const dy = cur.ay - at.y;
        const d = Math.hypot(dx, dy);
        const u = d > 1e-6 ? { x: dx / d, y: dy / d } : { x: 0, y: -1 };
        const R = this.ringR();
        // 뭉치가 남은 화면 안에 들도록 밀어내는 거리를 줄인다 — 새 중심은 화면 가운데로 오므로
        // 뭉치의 화면 자리는 가운데 + 이 벡터다. 패널이 열려 화면이 좁으면 그대로 두면 밖으로 나간다
        const f = this.freeRect();
        let vx = u.x * R * PROBE.prevDist;
        let vy = u.y * R * PROBE.prevDist;
        const bx = Math.max(1, (f.x1 - f.x0) / 2 - R * PROBE.prevScale - 24);
        const by = Math.max(1, (f.y1 - f.y0) / 2 - R * PROBE.prevScale - 24);
        const fit = Math.min(1, bx / Math.max(1e-6, Math.abs(vx)), by / Math.max(1e-6, Math.abs(vy)));
        vx *= fit;
        vy *= fit;
        cur.fx = cur.ax;
        cur.fy = cur.ay;
        cur.ax = at.x + vx;
        cur.ay = at.y + vy;
        cur.demotedAt = now;
      }
      p.rings.push({ centerId, ids, t0: now, ax: at.x, ay: at.y, fx: at.x, fy: at.y, demotedAt: null, unfold: true, leavingAt: null });
      const alive = p.rings.filter((r) => !r.leavingAt);
      for (const r of alive.slice(0, Math.max(0, alive.length - PROBE.maxRings))) r.leavingAt = now;
      // 새 중심이 화면 가운데로 오도록 오버레이를 민다. 드래그로 밀어 둔 양은 출발점에 접어 넣는다
      p.offFrom = this.probeOffset(now);
      p.pan = { x: 0, y: 0 };
      p.offTo = { x: -at.x, y: -at.y };
      p.offT0 = now;
      this.nearby = { centerId, ids };
      this.selectedId = centerId;
      return;
    }
    const back = p?.back ?? { ...this.cam };
    this.probe = {
      rings: [{ centerId, ids, t0: now, ax: 0, ay: 0, fx: 0, fy: 0, demotedAt: null, unfold: false, leavingAt: null }],
      exitingAt: null,
      back,
      offFrom: { x: 0, y: 0 },
      offTo: { x: 0, y: 0 },
      offT0: now,
      pan: { x: 0, y: 0 },
    };
    this.nearby = { centerId, ids };
    this.selectedId = centerId;
    this.focus(centerId, PROBE.zoomMul);
  }

  /** 주변 탐색 해제 — 곡들이 실제 자리로 돌아가고 카메라가 진입 전으로 복귀 */
  /**
   * 지도 목록에 없는 곡을 엔진에 **편입**한다 (주변 탐색 이웃처럼 별개 집합에서 온 곡).
   *
   * 좌표만 갖게 할 뿐 **상주 집합(subset)에는 넣지 않는다** — 넣으면 지도 구름의 일부가 되어
   * 별밭에 섞이고 카메라 맞춤·파고들기 기준까지 흔든다. alpha 도 0 이라 지도 별로는 그려지지 않고,
   * 연출 뷰가 자기 위치로만 그린다.
   */
  adopt(points: MapPoint[]) {
    const add = points.filter((p) => !this.index.has(p.musicId));
    if (!add.length) return;
    // keep 은 **기존 곡 수**다. 지금 있는 버퍼를 그만큼 그대로 옮기고 뒤만 새로 채운다
    const keep = this.N;
    this.allocate([...this.songs, ...add], keep);
    /**
     * **레이어 0 에서는 편입된 곡도 상주다** (S15P21A405-320).
     *
     * `allocate` 는 상주 마스크를 0 으로 늘리기만 한다. 그대로 두면 `isAlive` 가 false 라
     * `playingElsewhere()` 가 참이 되고, 최상단인데도 내 표식에 "다른 갈래에서 재생 중" 이
     * 붙었다 — 지도 샘플(1,071곡) 밖의 여정·플리 곡이 전부 그랬다.
     *
     * 레이어 0 의 `residentMask` 는 `ghostOnly` 와 무관하게 전부 1 이다. 그래서 여기서만 켠다.
     * 파고든 겹에서는 **진짜로 이 겹 밖의 곡**이라 0 으로 둔다.
     */
    if (this.layer === 0) {
      for (let i = keep; i < this.N; i++) {
        this.subset[i] = 1;
        this.alpha[i] = 1;
      }
      this.rebuildAliveIdx();
    }
    this.project();
  }

  exitProbe() {
    if (!this.probe || this.probe.exitingAt) return;
    this.probe.exitingAt = performance.now();
    this.nearby = null;
    if (!this.follow) this.camTarget = { ...this.probe.back };
  }

  /** 지금 고리 (밀려나는 중이 아닌 마지막 고리) */
  currentRing(): ProbeRing | null {
    const p = this.probe;
    if (!p) return null;
    for (let i = p.rings.length - 1; i >= 0; i--) if (!p.rings[i].leavingAt) return p.rings[i];
    return null;
  }

  /** 주변 탐색 중 드래그 — 오버레이 전체를 민다. 고리 하나 반지름 안에서만 (다 밀어내면 빈 화면이 된다) */
  probePan(dx: number, dy: number) {
    const p = this.probe;
    if (!p || p.exitingAt) return;
    const f = this.freeRect();
    const lim = Math.min(f.x1 - f.x0, f.y1 - f.y0) * PROBE.ringRatio;
    p.pan.x = Math.min(lim, Math.max(-lim, p.pan.x + dx));
    p.pan.y = Math.min(lim, Math.max(-lim, p.pan.y + dy));
  }

  /** 오버레이 공간 → 화면 중심 기준 이동량. 새 중심으로 미끄러지는 중이면 그 사이 값 */
  private probeOffset(now = performance.now()) {
    const p = this.probe!;
    const k = easeInOut(Math.min(1, (now - p.offT0) / PROBE.enterMs));
    return { x: lerp(p.offFrom.x, p.offTo.x, k) + p.pan.x, y: lerp(p.offFrom.y, p.offTo.y, k) + p.pan.y };
  }

  /** 고리 반지름(px) — 남은 화면의 짧은 변 기준 */
  private ringR() {
    const f = this.freeRect();
    return Math.min(f.x1 - f.x0, f.y1 - f.y0) * PROBE.ringRatio;
  }

  /** 물러난 고리의 진행도 0~1 (오므라들고 밀려나는 정도) */
  private demoteK(r: ProbeRing, now = performance.now()) {
    return r.demotedAt ? easeInOut(Math.min(1, (now - r.demotedAt) / PROBE.enterMs)) : 0;
  }

  /** 고리 크기 배수 — 지금 고리 1, 물러난 고리는 prevScale 로 */
  ringScale(r: ProbeRing, now = performance.now()) {
    return lerp(1, PROBE.prevScale, this.demoteK(r, now));
  }

  /** 고리 중심의 오버레이 자리 (밀려나는 중이면 그 사이) */
  private ringAnchor(r: ProbeRing, now = performance.now()) {
    const k = this.demoteK(r, now);
    return { x: lerp(r.fx, r.ax, k), y: lerp(r.fy, r.ay, k) };
  }

  /** 고리 중심에서 이웃까지의 상대 자리 (두 겹 고리, 유사한 곡이 안쪽). 물러난 고리는 오므라든 크기로 */
  private ringSlot(r: ProbeRing, id: number) {
    const rank = r.ids.indexOf(id);
    if (rank < 0) return null;
    const n = Math.max(1, r.ids.length);
    const R = this.ringR() * this.ringScale(r);
    const ring = rank % 2 === 0 ? PROBE.innerRing : 1;
    const jitter = (((id * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
    const ang = -Math.PI / 2 + (rank / n) * Math.PI * 2 + jitter * 0.25;
    return { x: Math.cos(ang) * R * ring, y: Math.sin(ang) * R * ring };
  }

  /**
   * 곡이 오버레이 공간에서 놓이는 자리와 그 고리.
   * **중심이었던 곡은 자기 고리를 따른다** — 이전 중심은 대개 새 중심의 이웃이기도 해서, 새 고리를 우선하면
   * 뭉치에서 떨어져 새 고리 안에 그려지고 뭉치는 중심 없이 남는다. 새 고리에서 그 자리로 가는 선은
   * 그대로 두 중심을 잇는 선이 된다. 그 외 곡은 여러 고리에 있으면 **가장 새 고리**를 따른다
   */
  private overlaySlot(id: number): { x: number; y: number; ring: ProbeRing } | null {
    const p = this.probe;
    if (!p) return null;
    for (let i = p.rings.length - 1; i >= 0; i--) {
      const r = p.rings[i];
      if (r.centerId === id) return { ...this.ringAnchor(r), ring: r };
    }
    for (let i = p.rings.length - 1; i >= 0; i--) {
      const r = p.rings[i];
      const sl = this.ringSlot(r, id);
      if (sl) {
        const a = this.ringAnchor(r);
        return { x: a.x + sl.x, y: a.y + sl.y, ring: r };
      }
    }
    return null;
  }

  private overlayPosOf(id: number) {
    const sl = this.overlaySlot(id);
    return sl ? { x: sl.x, y: sl.y } : null;
  }

  /** 프로브 전체 진행도 0~1 (진입 중 오르고, 해제 중 내려간다) */
  probeK(now = performance.now()) {
    const p = this.probe;
    if (!p) return 0;
    if (p.exitingAt) return 1 - easeInOut(Math.min(1, (now - p.exitingAt) / PROBE.exitMs));
    return easeInOut(Math.min(1, (now - p.rings[0].t0) / PROBE.enterMs));
  }

  /** 고리 하나의 진행도 — 생길 때 오르고, 밀려날 때 내려간다 */
  ringK(r: ProbeRing, now = performance.now()) {
    if (r.leavingAt) return 1 - easeInOut(Math.min(1, (now - r.leavingAt) / PROBE.exitMs));
    return easeInOut(Math.min(1, (now - r.t0) / PROBE.enterMs));
  }

  /** 프로브 곡의 화면 위치 — 실제 위치와 연출 배치 위치를 그 고리의 진행도로 보간 */
  probePos(id: number): { x: number; y: number } | null {
    const p = this.probe;
    if (!p) return null;
    const i = this.index.get(id);
    if (i == null) return null;
    const real = { x: this.pos[i * 2], y: this.pos[i * 2 + 1] };
    const sl = this.overlaySlot(id);
    if (!sl) return real;
    const f = this.freeRect();
    const off = this.probeOffset();
    const target = { x: f.cx + off.x + sl.x, y: f.cy + off.y + sl.y };
    // 밀려나는 고리의 곡도 제자리로 돌아가지 않고 **그 자리에서 옅어진다** — 돌아가면 화면을 가로질러 튄다
    if (p.exitingAt) {
      const k = this.probeK();
      return { x: lerp(real.x, target.x, k), y: lerp(real.y, target.y, k) };
    }
    if (sl.ring.leavingAt) return target;
    // 건너가기로 생긴 고리의 이웃은 지도 자리가 아니라 **중심에서 펼쳐져** 나온다 — 누른 별이 열리는 것으로 읽히게
    const k = this.ringK(sl.ring);
    if (sl.ring.unfold && sl.ring.centerId !== id) {
      const a = this.ringAnchor(sl.ring);
      return { x: lerp(f.cx + off.x + a.x, target.x, k), y: lerp(f.cy + off.y + a.y, target.y, k) };
    }
    return { x: lerp(real.x, target.x, k), y: lerp(real.y, target.y, k) };
  }

  /**
   * 프로브에 걸린 곡 전부. `clickable` 이면 밀려나는 고리는 빼고, **물러난 고리는 중심만** 남긴다
   * (S15P21A405-288) — 옅게 남은 이전 고리는 어디서 왔는지 보여 주는 기록이라 선으로만 읽히고,
   * 돌아갈 수 있는 곳은 그 중심 하나다
   */
  probeIdSet(clickable = false): Set<number> | null {
    if (!this.probe) return null;
    const cur = this.currentRing();
    const out = new Set<number>();
    for (const r of this.probe.rings) {
      if (clickable && r.leavingAt) continue;
      out.add(r.centerId);
      if (clickable && r !== cur) continue;
      for (const id of r.ids) out.add(id);
    }
    return out;
  }

  // ------------------------------------------------------------------ 별자리 오버레이 뷰 (PATH-01)
  /**
   * 여정·플레이리스트를 **임시 오버레이 뷰**로 연다. 주변 탐색과 같은 급이고 둘은 배타다 (PATH-01-1).
   * 곡들이 지금 자리에서 별자리 대형으로 날아가 모이고, 닫으면 흩어져 제자리로 돌아간다.
   * 배치는 백엔드가 16차원을 2D로 압축해 준 **고정 좌표**라 레이어와 무관하게 늘 같은 모양이다.
   */
  enterConstellation(ids: number[], layout: ConstellationPoint[]) {
    const valid = ids.filter((id) => this.index.has(id));
    if (valid.length < 2) return;
    if (this.constellation && !this.constellation.exitingAt && sameIds(this.constellation.ids, valid)) {
      this.constellation.layout = layout;
      this.constellation.box = this.layoutBox(layout);
      return;
    }
    this.constellation = { ids: valid, layout, box: this.layoutBox(layout), t0: performance.now(), exitingAt: null };
    this.route = valid;
    this.overlayReset();
  }

  /** 별자리 닫기 — 곡들이 실제 자리로 돌아간다. 카메라는 애초에 건드리지 않았다 */
  exitConstellation() {
    if (!this.constellation || this.constellation.exitingAt) return;
    this.constellation.exitingAt = performance.now();
    this.route = [];
  }

  /** 별자리 진행도 0~1 (진입 중 오르고, 해제 중 내려간다) */
  constellationK(now = performance.now()) {
    const c = this.constellation;
    if (!c) return 0;
    if (c.exitingAt) return 1 - easeInOut(Math.min(1, (now - c.exitingAt) / CONSTELLATION.exitMs));
    return easeInOut(Math.min(1, (now - c.t0) / CONSTELLATION.enterMs));
  }

  /**
   * 별자리 곡의 화면 위치 — 실제 위치와 배치 위치를 진행도로 보간한다.
   * 배치 좌표는 -1~1 정규화 값이라 남은 화면 중앙에 반지름을 곱해 놓는다.
   */
  constellationPos(id: number): { x: number; y: number } | null {
    const c = this.constellation;
    if (!c) return null;
    const i = this.index.get(id);
    if (i == null) return null;
    const real = { x: this.pos[i * 2], y: this.pos[i * 2 + 1] };
    const p = c.layout.find((q) => q.musicId === id);
    if (!p) return real;
    const f = this.constellationRect();
    const fit = this.constellationFit();
    const k = this.constellationK();
    const o = this.overlay;
    // 오버레이 안에서의 이동·확대를 배치 위에 얹는다
    const tx = f.cx + (p.x - fit.bx) * fit.s * o.zoom + o.dx;
    const ty = f.cy - (p.y - fit.by) * fit.s * o.zoom + o.dy;
    return { x: lerp(real.x, tx, k), y: lerp(real.y, ty, k) };
  }

  /**
   * 배치를 남은 영역에 **여백만 남기고 꽉 차게** 맞추는 변환.
   *
   * 백엔드 좌표는 -1~1 로 정규화돼 있지만 그 안 어디에 몰려 있을지는 모른다. 고정 반지름을 곱하면
   * 몰려 있는 배치가 몰린 채로 작게 나와 한 덩어리로 보인다. 그래서 **배치 자체의 바운딩박스**를
   * 재서 그것이 영역을 채우게 키운다. 가로·세로 같은 배율이라 모양은 그대로다
   * (PATH-01 — 플리 모양이 상품으로 성립해야 한다).
   */
  private constellationFit() {
    const b = this.constellation?.box;
    const f = this.constellationRect();
    if (!b) return { s: 1, bx: 0, by: 0 };
    const p = CONSTELLATION.pad;
    const fw = f.x1 - f.x0;
    const fh = f.y1 - f.y0;
    // 점이 하나뿐이거나 일직선이면 그 축은 넓이가 0 이다 — 다른 축 배율만 남게 크게 잡는다
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const sx = w > 1e-4 ? Math.max(1, fw - Math.min(p.maxPx, fw * p.ratio) * 2) / w : Infinity;
    const sy = h > 1e-4 ? Math.max(1, fh - Math.min(p.maxPx, fh * p.ratio) * 2) / h : Infinity;
    const s = Math.min(sx, sy);
    return { s: Number.isFinite(s) ? s : 1, bx: (b.x0 + b.x1) / 2, by: (b.y0 + b.y1) / 2 };
  }

  /** 배치 좌표의 바운딩박스 (화면과 무관하므로 배치가 바뀔 때만 잰다) */
  private layoutBox(layout: ConstellationPoint[]) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of layout) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    return Number.isFinite(x0) ? { x0, x1, y0, y1 } : { x0: 0, x1: 0, y0: 0, y1: 0 };
  }

  /**
   * 그리기용 — 해제 애니메이션이 도는 동안에도 필요하다 (곡들이 제자리로 흩어지는 걸 그려야 한다).
   * **클릭 판정에는 쓰지 않는다.** {@link clickableOverlayIds} 를 쓸 것.
   */
  constellationIdSet(): Set<number> | null {
    return this.constellation ? new Set(this.constellation.ids) : null;
  }

  /**
   * 클릭을 오버레이 안으로 **가둘 집합**. null 이면 지도의 아무 별이나 고를 수 있다.
   *
   * 오버레이(주변 탐색·별자리)가 떠 있는 동안에는 뒷화면 별을 고를 수 없어야 한다 (PATH-01-1).
   * 그 판정을 `constellationIdSet()` 같은 **그리기용 집합**으로 하면 안 된다 — 그건 해제 뒤에도
   * 잠깐(또는 정리를 빠뜨리면 영영) 남아 있어서, 닫은 뒤에도 지도가 먹통이 된다 (S15P21A405-270).
   * 그래서 여기서는 **떠 있는지**만 본다.
   */
  clickableOverlayIds(): Set<number> | null {
    if (this.constellationActive()) return this.constellationIdSet();
    if (this.probe && !this.probe.exitingAt) return this.probeIdSet(true);
    return null;
  }

  // ------------------------------------------------------------------ 고스트별 (MAP-12)
  /**
   * 이 겹에 없는 곡을 "지금 보는 범위 밖에 있다"고 치고 띄운다.
   * 레이어는 사용자에게 확대로 보이지만 실제로는 필터라, 확대만 했는데 찾던 곡이 없으면 납득이 안 된다.
   * 이미 이 겹에 있는 곡이면 고스트를 만들지 않는다 (그냥 확대해 보여주면 되므로).
   */
  setGhost(id: number) {
    if (!this.index.has(id) || this.isAlive(id)) {
      this.ghost = null;
      return;
    }
    this.ghost = { musicId: id, t0: performance.now() };
    this.frameGhost();
  }

  /**
   * 고스트별이 뜰 때 뷰를 물러나게 한다 — 확대해 들어온 상태에서는 구름이 화면을 다 채워서
   * "구름 밖"이 화면에 없다. 구름 끝을 화면 안으로 들이고 고스트 쪽 바깥 공간을 보여준다.
   */
  private frameGhost() {
    const dir = this.ghostDir();
    if (!dir || this.follow || this.anim) return;
    const extent = this.starRadius();
    if (extent < 1) return;
    const f = this.freeRect();
    const R = Math.min(f.x1 - f.x0, f.y1 - f.y0) / 2;
    // 구름이 화면보다 크면 그만큼 축소한다 (이미 작으면 배율은 그대로)
    const target = R * GHOST.viewCloudRatio;
    const s = extent > target ? this.cam.s * (target / extent) : this.cam.s;
    // 고스트가 뜨는 쪽으로 옮겨 그 바깥이 보이게. 화면 y 는 아래가 양수, 월드 y 는 위가 양수
    const shift = (R * GHOST.viewShiftRatio) / s;
    this.touched = true;
    this.camTarget = { s, cx: this.cam.cx + dir.x * shift, cy: this.cam.cy - dir.y * shift };
  }

  clearGhost() {
    this.ghost = null;
  }

  /** 고스트별 방향 (화면 좌표 단위벡터) — 레이어 0 좌표에서 내 곡 → 그 곡 */
  private ghostDir(): { x: number; y: number } | null {
    if (!this.ghost) return null;
    const i = this.index.get(this.ghost.musicId);
    const myI = this.myId != null ? this.index.get(this.myId) : undefined;
    if (i == null || myI == null) return null;
    const a = this.songs[i].pc;
    const b = this.songs[myI].pc;
    const dx = a[0] - b[0];
    // 월드 y 는 위가 양수, 화면 y 는 아래가 양수
    const dy = -(a[1] - b[1]);
    const d = Math.hypot(dx, dy);
    return d < 1e-6 ? { x: 0, y: -1 } : { x: dx / d, y: dy / d };
  }

  /**
   * 지금 겹의 별들을 다 감싸는 반지름 (화면 중심 기준 px).
   * 방향별 최댓값이 아니라 **전체를 감싸는 원**이어야 한다 — 방향 기준으로 재면 그 방향으로는 밖이어도
   * 옆으로는 별이 남아서 구름에 박힌 것처럼 보인다.
   */
  private starRadius() {
    const f = this.freeRect();
    let max = 0;
    for (let i = 0; i < this.N; i++) {
      if (!this.subset[i] || this.alpha[i] < 0.5) continue;
      const d = Math.hypot(this.pos[i * 2] - f.cx, this.pos[i * 2 + 1] - f.cy);
      if (d > max) max = d;
    }
    return max;
  }

  /**
   * 고스트별의 화면 위치 — 방향은 레이어 0 좌표에서 내 곡으로부터, 거리는
   * **이 겹 별들을 다 감싸는 반지름 + 여백**. 구름 안에는 어떤 경우에도 들어가지 않는다.
   * (구름이 화면을 넘어가면 표식도 화면 밖이다 — 그래서 뜰 때 frameGhost 가 뷰를 물러나게 한다)
   */
  ghostPos(): { x: number; y: number } | null {
    const dir = this.ghostDir();
    return dir ? this.outsideCloudPos(dir, this.cloudExtent) : null;
  }

  /**
   * 화면 안에 없는 것(고스트별·화면 밖 내 위치)을 **별 구름 밖**에 놓는다.
   * 상단 HUD 에 붙지 않게 내려오고, 그만큼 옆으로 밀어 구름과의 거리를 지킨다.
   */
  private outsideCloudPos(dir: { x: number; y: number }, extent: number) {
    const f = this.freeRect();
    // 놓을 수 있는 박스 — 위쪽은 상단 HUD 를 피해 더 내려온다
    const x0 = f.x0 + GHOST.edgeInset;
    const x1 = Math.max(x0 + 1, f.x1 - GHOST.edgeInset);
    const y0 = f.y0 + GHOST.topInset;
    const y1 = Math.max(y0 + 1, f.y1 - GHOST.edgeInset);
    // 구름 밖으로 밀되, 박스를 넘지 않는다 — 구름이 화면보다 크면 테두리에 붙는다
    const tx = Math.abs(dir.x) < 1e-6 ? Infinity : ((dir.x > 0 ? x1 : x0) - f.cx) / dir.x;
    const ty = Math.abs(dir.y) < 1e-6 ? Infinity : ((dir.y > 0 ? y1 : y0) - f.cy) / dir.y;
    const t = Math.max(0, Math.min(extent + GHOST.cloudMargin, Math.min(tx, ty)));
    let x = f.cx + dir.x * t;
    let y = f.cy + dir.y * t;
    // 위로 치우쳐 상단에 닿으면 옆으로 밀어 거리를 지킨다
    if (y < y0) {
      const side = dir.x >= 0 ? 1 : -1;
      const gap = Math.sqrt(Math.max(0, t * t - (y0 - f.cy) ** 2));
      y = y0;
      x = Math.min(x1, Math.max(x0, f.cx + side * Math.max(gap, t * 0.35)));
    }
    return { x, y };
  }

  /** 고스트별 페이드 진행도 */
  ghostK(now = performance.now()) {
    return this.ghost ? easeInOut(Math.min(1, (now - this.ghost.t0) / GHOST.enterMs)) : 0;
  }

  /** 고스트별 클릭 판정 — 맞으면 그 곡 ID */
  hitGhost(mx: number, my: number): number | null {
    const p = this.ghostPos();
    if (!p || !this.ghost) return null;
    return (p.x - mx) ** 2 + (p.y - my) ** 2 < GHOST.hitRadius ** 2 ? this.ghost.musicId : null;
  }

  /** 떠 있는 HUD 상자를 갱신한다 (map-view 가 DOM 을 재서 넘긴다) */
  setObstacles(rects: { x0: number; y0: number; x1: number; y1: number }[]) {
    this.obstacles = rects;
  }

  /**
   * 화면 밖 표식을 놓을 자리 — **가장자리에 최대한 붙인다.**
   *
   * 지도가 보이는 사각형을 {@link ME_OFFSCREEN.edgeGap} 만큼 줄인 상자의 **테두리 위**에서 고른다.
   * 방향이 만나는 점이 HUD 에 가리면 안쪽으로 물러나지 않고 **테두리를 따라 미끄러져** 빈 자리를
   * 찾는다 — 안으로 물러나면 "지금 보는 화면 위에 떠 있다"로 읽히기 때문이다.
   * 고르는 기준은 원래 방향과의 **각도 차이가 가장 작은** 빈 자리다.
   */
  private edgePos(dir: { x: number; y: number }) {
    const f = this.freeRect();
    const g = ME_OFFSCREEN.edgeGap;
    const x0 = f.x0 + g;
    const y0 = f.y0 + g;
    const x1 = Math.max(x0 + 1, f.x1 - g);
    const y1 = Math.max(y0 + 1, f.y1 - g);
    const want = Math.atan2(dir.y, dir.x);
    const step = 10;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    let fallback: { x: number; y: number } | null = null;
    let fallbackD = Infinity;
    const consider = (x: number, y: number) => {
      // 중심에서 본 각도가 원하는 방향과 얼마나 다른가 (-π~π 로 감싼다)
      let d = Math.abs(Math.atan2(y - f.cy, x - f.cx) - want);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < fallbackD) {
        fallbackD = d;
        fallback = { x, y };
      }
      if (this.blocked(x, y) || d >= bestD) return;
      bestD = d;
      best = { x, y };
    };
    for (let x = x0; x <= x1; x += step) {
      consider(x, y0);
      consider(x, y1);
    }
    for (let y = y0; y <= y1; y += step) {
      consider(x0, y);
      consider(x1, y);
    }
    // 테두리가 전부 막혔으면 방향만이라도 맞춘다
    return best ?? fallback ?? { x: f.cx, y: f.cy };
  }

  /** 그 점이 HUD 상자(간격 포함) 안인가 */
  private blocked(x: number, y: number) {
    const g = ME_OFFSCREEN.edgeGap;
    return this.obstacles.some((o) => x > o.x0 - g && x < o.x1 + g && y > o.y0 - g && y < o.y1 + g);
  }

  // ------------------------------------------------------------------ 화면 밖 '나' (MAP-08)
  /**
   * 내 표식의 **화면 자리**와 꼬리 출발점 (S15P21A405-288).
   * 주변 탐색 중 고리 안 곡에 앉아 있으면 그 곡의 연출 자리(probePos)다 — 실제 좌표로 그리면 고리에서 떨어진
   * 엉뚱한 곳에 뜬다. 고리 안 이동(meHop) 중이면 출발한 화면 자리에서 지금 자리로 곡선 없이 미끄러진다.
   * 그 밖에는 월드 좌표(me)를 그대로 화면으로 옮긴다
   */
  meScreen(now = performance.now()): { px: number; py: number; from: { px: number; py: number } | null; onRing: boolean } {
    if (this.myId != null && this.probe && !this.probe.exitingAt) {
      const at = this.probePos(this.myId);
      if (at && this.overlaySlot(this.myId)) {
        const hop = this.meHop;
        if (hop) {
          const t = Math.min(1, (now - hop.t0) / ME_FLIGHT.hopMs);
          if (t >= 1) this.meHop = null;
          else {
            const e = easeInOut(t);
            return { px: lerp(hop.x, at.x, e), py: lerp(hop.y, at.y, e), from: { px: hop.x, py: hop.y }, onRing: true };
          }
        }
        return { px: at.x, py: at.y, from: null, onRing: true };
      }
    }
    this.meHop = null;
    const { px, py } = this.worldToScreen(this.me.x, this.me.y);
    const fl = this.meFlight;
    return { px, py, from: fl ? this.worldToScreen(fl.ax, fl.ay) : null, onRing: false };
  }

  /**
   * 화면 밖으로 나간 '나' 표식의 자리와 방향. **null 이면 화면 안**이라 제자리에 그리면 된다.
   *
   * 내 위치는 곧 지금 재생 중인 곡이다 (MAP-08). 그래서 두 갈래로 갈린다.
   * - 그 곡이 **이 겹에 상주하면** 실제 자리 방향. 화면 안으로 돌아오면 화살표는 사라진다.
   * - **이 겹에 없으면** 파고들어온 경로를 거슬러 올라가 방향을 잰다 ({@link awayDir}).
   *   자리가 이 겹에 없으니 화면 안이고 밖이고를 따질 것도 없이 늘 화살표다 — 글씨로 알리지 않고
   *   가생이에 붙은 옅은 점으로만 알린다. 돌아오는 길은 "내 위치로 가기" 가 맡는다.
   */
  meArrow(): { x: number; y: number; dir: { x: number; y: number }; elsewhere: boolean } | null {
    if (this.anim || this.follow || this.myId == null || this.constellationActive()) return null;
    const id = this.playingId ?? this.myId;
    // 고리 안 곡에 앉아 있으면 화면 안이다 — 상주하지 않는 이웃이라도 "다른 데 있다" 화살표로 갈리지 않는다
    if (this.probe && !this.probe.exitingAt && this.overlaySlot(id)) return null;
    const elsewhere = !this.isAlive(id);
    let dir: { x: number; y: number } | null;
    if (elsewhere) {
      dir = this.awayDir(id);
    } else {
      const { px, py } = this.worldToScreen(this.me.x, this.me.y);
      const f = this.freeRect();
      const m = ME_OFFSCREEN.inset;
      if (px > f.x0 + m && px < f.x1 - m && py > f.y0 + m && py < f.y1 - m) return null;
      dir = unit(px - f.cx, py - f.cy);
    }
    if (!dir) return null;
    // 둘 다 "화면 밖"이므로 가장자리에 붙인다. HUD 에 가리면 edgePos 가 안쪽으로 물러난다
    const p = this.edgePos(dir);
    return { x: p.x, y: p.y, dir, elsewhere };
  }

  /**
   * 이 겹에 없는 곡의 방향 (화면 좌표 단위벡터).
   *
   * 파고들어온 경로(stack)를 **깊은 쪽부터** 거슬러 올라가 그 곡이 상주하던 첫 겹을 찾는다 —
   * 바로 윗 겹에 없으면 그 위로 계속 올라간다. 그 겹에서 **내가 파고든 지점**
   * (그 겹을 떠날 때의 카메라 중심) 에서 그 곡까지의 방향을 잰다.
   * 스택은 이 겹에 머무는 동안 바뀌지 않으므로 **방향도 그대로 유지된다.**
   *
   * 어느 윗 겹에도 없으면 지금 겹 축으로라도 잰다 — 좌표는 16차원이 다 있으니
   * 상주하지 않을 뿐 잴 수는 있다. 화살표가 소리 없이 사라지는 것보다 낫다.
   */
  private awayDir(id: number): { x: number; y: number } | null {
    const i = this.index.get(id);
    if (i == null) return null;
    const pc = this.songs[i].pc;
    for (let k = this.stack.length - 1; k >= 0; k--) {
      const f = this.stack[k];
      if (!f.subset[i]) continue;
      // 월드 y 는 위가 양수, 화면 y 는 아래가 양수
      const d = unit(pc[f.layer * 2] - f.cam.cx, -(pc[f.layer * 2 + 1] - f.cam.cy));
      if (d) return d;
    }
    return unit(pc[this.dx()] - this.cam.cx, -(pc[this.dy()] - this.cam.cy));
  }

  /** 별자리가 화면을 차지하고 있는가 (해제 애니메이션 중이면 false) */
  constellationActive() {
    return !!this.constellation && !this.constellation.exitingAt;
  }

  /** 별자리를 놓을 영역 — 좌하단 계기판 위에 얹히지 않게 뺀다 */
  private constellationRect() {
    const base = this.freeRect();
    const x0 = base.x0 + CONSTELLATION.instrumentInsetPx;
    const y1 = base.y1 - 20;
    return { x0, y0: base.y0, x1: base.x1, y1, cx: (x0 + base.x1) / 2, cy: (base.y0 + y1) / 2 };
  }

  // ------------------------------------------------------------------ geometry
  private dx() {
    return this.layer * 2;
  }
  private dy() {
    return this.layer * 2 + 1;
  }

  /** 패널·HUD를 뺀 "실제로 지도가 보이는 사각형" */
  freeRect() {
    const x0 = 0;
    const x1 = Math.max(120, this.W - this.occludedRight);
    const y0 = 58;
    const y1 = Math.max(y0 + 120, this.H - 92);
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  worldToScreen(x: number, y: number, cam = this.cam) {
    return { px: this.W / 2 + (x - cam.cx) * cam.s, py: this.H / 2 - (y - cam.cy) * cam.s };
  }

  screenToWorld(px: number, py: number, cam = this.cam) {
    return { x: cam.cx + (px - this.W / 2) / cam.s, y: cam.cy - (py - this.H / 2) / cam.s };
  }

  /**
   * 지금 화면에 담긴 영역을 이 겹의 축 범위로 (countInView 가 세는 사각형과 같다).
   * 파고들 때 이 범위를 누적에 쌓아 다음 겹 상주 집합을 요청한다.
   */
  private viewBox(): LayerBox {
    const f = this.freeRect();
    const lo = this.screenToWorld(f.x0, f.y1);
    const hi = this.screenToWorld(f.x1, f.y0);
    return { layer: this.layer, xMin: lo.x, xMax: hi.x, yMin: lo.y, yMax: hi.y };
  }

  /** 깊이 시차 — 앞쪽(z>0) 별이 조금 더 크게 움직인다 (프로토타입 par) */
  private par(i: number) {
    return 1 + this.z[i] * STAR_VIEW.parallax;
  }

  private proj(i: number, layer: number, cam: MapCamera, out: Float32Array, k: number) {
    const s = this.songs[i];
    const p = this.par(i);
    out[k] = this.W / 2 + (s.pc[layer * 2] - cam.cx) * cam.s * p;
    out[k + 1] = this.H / 2 - (s.pc[layer * 2 + 1] - cam.cy) * cam.s * p;
    // 좌표가 깨지면 그리기에서 건너뛰지만, 원인(pc 누락·카메라 붕괴)은 여기서만 알 수 있다 — 개발 중엔 한 번 알린다
    if (process.env.NODE_ENV !== "production" && !warnedNaN && !(Number.isFinite(out[k]) && Number.isFinite(out[k + 1]))) {
      warnedNaN = true;
      console.warn("[map] non-finite projection", { musicId: s.musicId, layer, pc: s.pc, cam, z: this.z[i] });
    }
  }

  private project() {
    for (let i = 0; i < this.N; i++) this.proj(i, this.layer, this.cam, this.pos, i * 2);
  }

  /** 곡의 현재 레이어 월드 좌표 */
  worldOf(id: number): { x: number; y: number } | null {
    const i = this.index.get(id);
    if (i == null) return null;
    const s = this.songs[i];
    return { x: s.pc[this.dx()], y: s.pc[this.dy()] };
  }

  isAlive(id: number) {
    const i = this.index.get(id);
    return i != null && this.subset[i] === 1;
  }

  private centerMost() {
    let b = 0;
    let bd = 1e9;
    for (let i = 0; i < this.N; i++) {
      const d = Math.abs(this.songs[i].pc[0]) + Math.abs(this.songs[i].pc[1]);
      if (d < bd) {
        bd = d;
        b = i;
      }
    }
    return this.songs[b].musicId;
  }

  /**
   * 카메라 맞춤: 기준 곡을 남은 화면 중앙에.
   *
   * - **레이어 0**: 지금까지의 규칙 그대로. 중심에서의 거리 97분위를 화면 44% 반지름에 맞춘다.
   * - **파고든 겹(1 이상)**: 거리 분위수는 꼬리에 끌려가 알맹이를 작게 모은다. 파고들기는
   *   "그 부분만 확대해 들어간다" 는 컨셉이라 들어간 순간 화면이 꽉 차야 하므로,
   *   **가로·세로를 따로 잰 분위수 상자**가 화면의 {@link DRILL.deepFit.fill} 을 채우게 맞춘다.
   */
  private fitCam(layer: number, mask: Uint8Array<ArrayBufferLike>, centerId: number): MapCamera {
    const dx = layer * 2;
    const dy = layer * 2 + 1;
    const c = this.songs[this.index.get(centerId)!];
    const f = this.freeRect();
    if (layer === 0) {
      const s = this.fitRadial(dx, dy, mask, c.pc);
      return this.saneCam({ cx: c.pc[dx] - (f.cx - this.W / 2) / s, cy: c.pc[dy] + (f.cy - this.H / 2) / s, s });
    }
    /**
     * 파고든 겹은 **구름 한가운데**를 본다. 기준 곡에 맞추면 그 곡이 무리 가장자리일 때
     * 절반이 화면 밖으로 나간다 — 실측상 상주 1,000곡 중 40%만 화면에 들어왔다.
     * "이 부분을 확대해 들어왔다" 는 컨셉이라 들어온 영역 전체가 보여야 한다.
     */
    const b = this.fitBox(dx, dy, mask);
    return this.saneCam({ cx: b.cx - (f.cx - this.W / 2) / b.s, cy: b.cy + (f.cy - this.H / 2) / b.s, s: b.s });
  }

  /** 배율이 0·무한대·NaN 이면 카메라가 통째로 깨져 모든 좌표가 NaN 이 된다 — 그럴 땐 지금 카메라를 그대로 쓴다 */
  private saneCam(c: MapCamera): MapCamera {
    return Number.isFinite(c.s) && c.s > 0 && Number.isFinite(c.cx) && Number.isFinite(c.cy) ? c : { ...this.cam };
  }

  /** 레이어 0 맞춤 — 기준 곡에서의 거리 분위수를 화면 반지름에 맞춘다 */
  private fitRadial(dx: number, dy: number, mask: Uint8Array<ArrayBufferLike>, c: number[]) {
    const d: number[] = [];
    for (let i = 0; i < this.N; i++) if (mask[i]) d.push(Math.hypot(this.songs[i].pc[dx] - c[dx], this.songs[i].pc[dy] - c[dy]));
    d.sort((a, b) => a - b);
    const r = d[Math.floor(d.length * DRILL.fitQuantile)] || 1;
    const f = this.freeRect();
    return (Math.min(f.x1 - f.x0, f.y1 - f.y0) * DRILL.fitRadiusRatio) / r;
  }

  /**
   * 파고든 겹 맞춤 — 분위수 상자가 화면을 꽉 채우는 배율(가로·세로 중 더 빡빡한 쪽)과
   * 그 상자의 한가운데(월드 좌표).
   */
  private fitBox(dx: number, dy: number, mask: Uint8Array<ArrayBufferLike>) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < this.N; i++) {
      if (!mask[i]) continue;
      xs.push(this.songs[i].pc[dx]);
      ys.push(this.songs[i].pc[dy]);
    }
    if (!xs.length) return { s: this.cam.s, cx: this.cam.cx, cy: this.cam.cy };
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const lo = Math.floor((xs.length - 1) * DRILL.deepFit.trim);
    const hi = Math.ceil((xs.length - 1) * (1 - DRILL.deepFit.trim));
    const w = Math.max(1e-6, xs[hi] - xs[lo]);
    const h = Math.max(1e-6, ys[hi] - ys[lo]);
    const f = this.freeRect();
    const s = Math.min(((f.x1 - f.x0) * DRILL.deepFit.fill) / w, ((f.y1 - f.y0) * DRILL.deepFit.fill) / h);
    return { s, cx: (xs[lo] + xs[hi]) / 2, cy: (ys[lo] + ys[hi]) / 2 };
  }

  // ------------------------------------------------------------------ layer transitions
  /**
   * 겹 전환. 두 겹을 **교차 확대**로 겹쳐 보여준다 (DRILL.dive) —
   * from 은 지금 화면에 보이던 자리, to 는 새 겹에서의 자리이고, 각자 자기 자리에서
   * 화면 중앙을 기준으로 커지거나 작아지기만 한다. 별이 새 자리로 미끄러지지 않는다.
   */
  private morph(newLayer: number, newCam: MapCamera, newSubset: Uint8Array<ArrayBufferLike>, big: string, sub: string, dir: 1 | -1 = 1, entryS?: number, mode: "dive" | "fade" = "dive") {
    // 레이어를 옮기면 고스트별은 사라진다 (MAP-12)
    this.ghost = null;
    for (let i = 0; i < this.N; i++) {
      this.from[i * 2] = this.pos[i * 2];
      this.from[i * 2 + 1] = this.pos[i * 2 + 1];
      this.aFrom[i] = this.alpha[i];
    }
    this.aimAt(newLayer, newCam, newSubset);
    this.pressure = 0;
    this.prefetch = null;
    this.camTarget = null;
    this.morphT = 0;
    this.anim = { t0: performance.now(), layer: newLayer, cam: newCam, subset: newSubset, big, sub, dir, entryS, mode };
  }

  /** 도착 자리·알파를 다시 계산한다. 진행 중인 전환의 목적지만 바꿀 때도 쓴다 */
  private aimAt(layer: number, cam: MapCamera, subset: Uint8Array<ArrayBufferLike>) {
    for (let i = 0; i < this.N; i++) {
      this.aTo[i] = subset[i] ? 1 : 0;
      this.proj(i, layer, cam, this.to, i * 2);
    }
  }

  /**
   * 진행 중인 전환의 **목적지만** 바꾼다 — 시작 시각·출발 자리는 그대로다.
   * 파고들기는 임시 집합으로 먼저 출발하고 겹 응답은 나중에 오는데, 그때 morph 를 다시 부르면
   * 전환이 처음부터 다시 시작돼 **두 번 일어난 것처럼** 보였다 (S15P21A405-284).
   * 들어오는 겹은 초반에 거의 안 보이므로 자리를 바꿔 끼워도 튀지 않는다.
   */
  private retarget(cam: MapCamera, subset: Uint8Array<ArrayBufferLike>) {
    const a = this.anim;
    if (!a) return;
    this.aimAt(a.layer, cam, subset);
    a.cam = cam;
    a.subset = subset;
  }

  /** 지금 배율이 이 레이어에 들어온 배율의 몇 배인가. 1 = 진입 배율 */
  zoomK() {
    return this.cam.s / this.entryS;
  }

  /**
   * 파고들 만큼 좁혔는가 (S15P21A405-342).
   *
   * **화면 안 곡 수**로 잰다 — 배율 배수로 재면 진입 배율이 겹마다 달라서 같은 배수가 어떤 겹에선
   * 207곡, 어떤 겹에선 1곡을 뜻했다. 곡 수는 확대할수록 단조 감소라 반드시 언젠가 열린다.
   *
   * **비어 있어도 막지 않는다.** 빈 화면은 "더 확대해라" 가 아니라 "이미 다 좁혔다" 다 —
   * 성긴 곳에서 파고들어도 {@link drillBox} 가 가장 가까운 곡을 가운데 두고 상자를 넓혀
   * `minInView` 만큼 모아 보낸다.
   */
  private zoomedEnough() {
    return this.zoomK() >= DRILL.gateMinZoom && this.countInView() <= this.gateMaxInView();
  }

  /**
   * 게이트가 열리는 화면 안 곡 수 — **밀도 × 지금 보이는 넓이**다.
   *
   * 수로 고정하면 큰 모니터에서는 같은 배율에 더 많이 보여 훨씬 많이 확대해야 한다.
   * 우측 패널이 열려 영역이 좁아져도 같은 이유로 함께 줄어든다.
   * 바닥은 `minInView` 다 — 그보다 적게 잡으면 파고들기가 쓸 곡보다 적어진다.
   */
  private gateMaxInView() {
    const f = this.freeRect();
    const areaMpx = ((f.x1 - f.x0) * (f.y1 - f.y0)) / 1e6;
    return Math.max(DRILL.minInView, DRILL.gateMaxDensity * areaMpx);
  }

  /**
   * 게이트까지 얼마나 왔나 (0~1). 안내 막대가 이걸로 찬다 — 게이트 조건과 같은 값을 봐야
   * 막대가 꽉 찼는데 안 열리거나, 덜 찼는데 열리는 일이 없다.
   */
  gateProgress() {
    const byZoom = Math.min(1, this.zoomK() / DRILL.gateMinZoom);
    const n = this.countInView();
    const max = this.gateMaxInView();
    const byCount = n <= max ? 1 : max / n;
    return Math.min(byZoom, byCount);
  }

  /**
   * 게이트 조건은 descend() 와 **정확히 같아야 한다.**
   * 어긋나면 압력만 차오르고 내려가지는 않아서 휠이 먹통이 된다 (확대도 멈춰 있으므로).
   */
  gateOpen() {
    return this.layer < LAYER_COUNT - 1 && this.zoomedEnough();
  }

  /**
   * 한 겹 파고들기.
   * **화면 안에 담긴 곡이 다음 겹의 기준**이다 — 그 영역(viewBox)을 누적 범위에 쌓으면
   * 그 조건으로 다음 겹 상주 집합을 받아오고, 도착하면 setLayerSongs 가 갈아끼운다.
   * 응답이 오기 전까지는 지금 겹 곡을 그대로 새 두 축에 뿌려 둔다 (BACKEND-NOTES A-1).
   */
  descend() {
    if (this.anim || this.pending || this.layer >= LAYER_COUNT - 1 || this.follow || !this.zoomedEnough()) return;
    // 미리 받게 알린 상자가 있으면 **그 상자 그대로** 쓴다 — 조금이라도 다르면 캐시 키가 갈려 미리 받은 게 헛일이다
    const box = this.prefetch?.[this.layer] ?? this.drillBox();
    if (!this.prefetch) this.prefetch = [...this.boxes, box];
    this.pending = { box, inView: this.countInBox(box), since: performance.now(), s0: this.cam.s };
    // 기다리는 동안 게이지는 꽉 찬 채로 둔다 — 빠지면 "안 먹었다" 로 읽힌다
    this.pressure = 1;
    this.tryStartPending(performance.now());
  }

  /** 화면이 미리 받은 다음 겹 집합을 넘겨준다. 기다리던 파고들기가 있으면 바로 출발한다 */
  setPrefetched(boxes: readonly LayerBox[], songs: MapPoint[]) {
    this.prefetched = { boxes, songs };
    if (this.pending) this.tryStartPending(performance.now());
  }

  /**
   * 대기 중인 파고들기를 출발시킨다. 실제 집합이 있으면 그걸로, `DRILL.waitForLayerMs` 를 넘기면 임시 집합으로.
   * 실제 집합으로 출발하면 도중에 갈아 끼울 일이 없어 들어오는 별이 제자리에서 그대로 자란다
   */
  private tryStartPending(now: number) {
    const p = this.pending;
    if (!p) return;
    const nl = this.layer + 1;
    const want = [...this.boxes, p.box];
    const ready = this.prefetched && sameBoxes(this.prefetched.boxes, want) ? this.prefetched.songs : null;
    if (!ready && now - p.since < DRILL.waitForLayerMs) return;
    this.pending = null;
    this.stack.push({ layer: this.layer, cam: { ...this.cam }, subset: this.subset.slice(), entryS: this.entryS });
    this.boxes = want;
    let ns: Uint8Array<ArrayBufferLike>;
    let big: string;
    if (ready) {
      ns = this.maskFor(nl, ready);
      big = `${LAYER_NAMES[nl]}${ro(LAYER_NAMES[nl])} 파고드는 중 — 상주 ${ready.length.toLocaleString()}곡`;
    } else {
      // 임시 집합: 지금 겹 곡을 그대로 데려간다 (확인용 고스트곡은 레이어 0 아래로 따라오지 않는다)
      ns = this.residentMask(nl);
      for (let i = 0; i < this.N; i++) if (!this.subset[i]) ns[i] = 0;
      big = `${LAYER_NAMES[nl]}${ro(LAYER_NAMES[nl])} 파고드는 중 — 화면 안 ${p.inView.toLocaleString()}곡 기준`;
    }
    const axes = axisLine(nl);
    this.morph(nl, this.fitCam(nl, ns, this.fitAnchor(ns, nl)), ns, big, axes);
  }

  /** 응답으로 받은 곡들을 상주 마스크로. 처음 보는 곡은 편입하고, 고정 곡은 남긴다 */
  private maskFor(layer: number, songs: MapPoint[]) {
    const add = songs.filter((s) => !this.index.has(s.musicId));
    if (add.length) this.allocate([...this.songs, ...add], this.N);
    const ns = new Uint8Array(this.N);
    for (const s of songs) ns[this.index.get(s.musicId)!] = 1;
    this.keepPinned(ns, layer);
    return ns;
  }

  /** 그 범위 안에 있는 상주 곡 수 */
  private countInBox(b: LayerBox) {
    const dx = b.layer * 2;
    const dy = b.layer * 2 + 1;
    let n = 0;
    for (let i = 0; i < this.N; i++) {
      if (!this.subset[i]) continue;
      const p = this.songs[i].pc;
      if (p[dx] >= b.xMin && p[dx] <= b.xMax && p[dy] >= b.yMin && p[dy] <= b.yMax) n++;
    }
    return n;
  }

  /**
   * 다음 겹으로 가져갈 범위.
   *
   * 백엔드에는 **점이 아니라 사각형**을 보낸다 (`pc{k}min`/`pc{k}max`). 그래서 "가장 가까운 별을
   * 보낸다" 는 대신 **그 별을 가운데 두는 사각형**을 만든다.
   *
   * 화면 안에 곡이 충분하면 보던 화면 그대로가 기준이다. 모자라면 — 빈 곳을 확대한 경우 —
   * 화면 중앙에서 **가장 가까운 곡**을 찾아 그 곡을 가운데 두고, 최소 곡 수가 담길 때까지
   * 화면 비율 그대로 넓힌다. 빈 곳에서 확대했다고 파고들지 못하면 휠이 먹통으로 느껴진다.
   */
  private drillBox(): LayerBox {
    const view = this.viewBox();
    if (this.countInBox(view) >= DRILL.minInView) return view;
    const dx = this.dx();
    const dy = this.dy();
    const f = this.freeRect();
    const c = this.screenToWorld(f.cx, f.cy);
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.N; i++) {
      if (!this.subset[i]) continue;
      const p = this.songs[i].pc;
      const d = (p[dx] - c.x) ** 2 + (p[dy] - c.y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return view;
    const p = this.songs[best].pc;
    const hw = (view.xMax - view.xMin) / 2;
    const hh = (view.yMax - view.yMin) / 2;
    let box = view;
    for (let k = 1; k <= DRILL.nearestGrowMax; k *= DRILL.nearestGrowStep) {
      box = { layer: this.layer, xMin: p[dx] - hw * k, xMax: p[dx] + hw * k, yMin: p[dy] - hh * k, yMax: p[dy] + hh * k };
      if (this.countInBox(box) >= DRILL.minInView) break;
    }
    return box;
  }

  /** 한 겹 떠오르기 — 두고 온 곡이 돌아오고 좌표 복원. 그 아래에서 좁혔던 범위는 버린다 */
  ascend() {
    if (this.anim || this.pending || !this.stack.length || this.follow) return;
    const p = this.stack.pop()!;
    this.boxes = this.boxes.slice(0, p.layer);
    const dx = p.layer * 2;
    const dy = p.layer * 2 + 1;
    /**
     * **배율은 그 겹에 처음 들어왔던 것으로 되돌린다** (S15P21A405-327).
     *
     * `p.cam.s` 는 게이트를 밀며 한 겹 최대(`zoomRange.max`)까지 확대된 뒤 대기 중 `waitZoom`
     * 까지 더해진 값이라 진입 배율의 7배를 넘는다. 그대로 복원하면 **축소하려고 휠을 돌렸는데
     * 최대 확대 상태의 좁은 구역에 착지하고**, 그 구역이 비어 있으면 화면에 별이 하나도 없다.
     * 진입 배율은 그 겹이 화면에 맞춰지던 배율이므로 여기로 오면 별이 화면을 채운다.
     */
    const s = p.entryS;
    /**
     * 내 곡을 가운데 두는 건 **그 곡이 이 겹에 상주할 때만** 이다.
     * 없는 곡 좌표로 가면 그 겹에 아무것도 없는 빈 곳이라 역시 화면이 텅 빈다.
     */
    const mi0 = this.myId != null ? this.index.get(this.myId) : undefined;
    const mi = mi0 != null && p.subset[mi0] ? mi0 : undefined;
    const f = this.freeRect();
    // 내 자리가 있으면 그 곡을 가운데 두고 떠오른다. 없으면 두고 온 카메라 그대로
    const c: MapCamera =
      mi == null
        ? { ...p.cam, s }
        : {
            ...p.cam,
            s,
            cx: this.songs[mi].pc[dx] - (f.cx - this.W / 2) / s,
            cy: this.songs[mi].pc[dy] + (f.cy - this.H / 2) / s,
          };
    const axes = axisLine(p.layer);
    this.morph(p.layer, c, p.subset, `${LAYER_NAMES[p.layer]}으로 떠오르는 중`, axes, -1, p.entryS);
  }

  // ------------------------------------------------------------------ input
  /** 휠. 게이트가 열리면 배율은 멈추고 압력만 찬다 */
  wheel(deltaY: number, mx: number, my: number): "zoom" | "pressure" | "blocked" {
    if (this.anim || this.pending || this.follow) return "blocked";
    // 확대·축소도 "내가 화면을 움직인" 것이다 — 가운데 고정을 푼다
    this.centerLock = false;
    const zoomIn = deltaY < 0;
    const canDig = zoomIn && this.gateOpen();
    // 파고든 겹에서는 진입 배율이 곧 축소 한계다 — 거기서 더 줄이려 하면 바로 떠오르기다
    const riseAt = this.layer > 0 ? DRILL.deepZoomOutRatio : DRILL.riseScaleRatio;
    const canRise = !zoomIn && this.stack.length > 0 && this.cam.s <= this.entryS * riseAt;
    if (canDig || canRise) {
      this.pressureDir = canDig ? 1 : -1;
      // 압력이 차는 동안 카메라는 멈춰 있으므로 지금 상자가 곧 파고들 때의 상자다 — 미리 받게 알린다
      if (canDig && !this.prefetch) this.prefetch = [...this.boxes, this.drillBox()];
      this.pressure = Math.min(1, this.pressure + Math.abs(deltaY) * DRILL.pressurePerDelta);
      if (this.pressure >= 1) {
        if (canDig) this.descend();
        else this.ascend();
      }
      return "pressure";
    }
    this.camTarget = null;
    this.touched = true;
    this.prefetch = null;
    const w = this.screenToWorld(mx, my);
    const want = this.cam.s * Math.exp(-deltaY * WHEEL_ZOOM);
    // 한 겹 안에서 확대·축소 한계 (게이트가 닫혀 있어도 빈 곳으로 무한히 들어가지 않게).
    // 파고든 겹의 축소 한계는 진입 배율 자체다 — 그 아래는 빈 우주만 보여 줄 뿐이다
    const minK = this.layer > 0 ? DRILL.deepZoomOutRatio : DRILL.zoomRange.min;
    this.cam.s = Math.min(this.entryS * DRILL.zoomRange.max, Math.max(this.entryS * minK, want));
    this.cam.cx = w.x - (mx - this.W / 2) / this.cam.s;
    this.cam.cy = w.y + (my - this.H / 2) / this.cam.s;
    this.clampCam();
    this.project();
    return "zoom";
  }

  dragBy(dx: number, dy: number) {
    if (this.anim || this.pending || this.follow) return;
    this.camTarget = null;
    this.prefetch = null;
    this.touched = true;
    this.centerLock = false;
    this.cam.cx -= dx / this.cam.s;
    this.cam.cy += dy / this.cam.s;
    this.clampCam();
    this.project();
  }

  setCameraCenter(x: number, y: number) {
    if (this.anim || this.follow) return;
    this.camTarget = { ...this.cam, cx: x, cy: y };
  }

  /** 곡을 남은 화면 중앙으로. scaleMul 이 있으면 그만큼 확대 */
  focus(id: number, scaleMul?: number) {
    const w = this.worldOf(id);
    if (!w || !this.isAlive(id) || this.follow) return;
    this.touched = true;
    const f = this.freeRect();
    const s = scaleMul ? Math.max(this.cam.s, this.entryS * scaleMul) : this.cam.s;
    this.camTarget = { s, cx: w.x - (f.cx - this.W / 2) / s, cy: w.y + (f.cy - this.H / 2) / s };
  }

  /**
   * 곡을 **보기만** 한다 — 카메라만 그리로 가고 '나'는 제자리다 (S15P21A405-277).
   * 지도에서 별을 눌렀을 때의 동작이다. 재생은 여기서 하지 않는다.
   *
   * 가운데 고정을 반드시 푼다. 안 풀면 `frame` 이 매 프레임 카메라를 재생 중인 곡으로
   * 되돌려서, 옮겨 간 뷰가 곧바로 튕겨 돌아온다.
   */
  viewSong(id: number) {
    if (this.follow || this.constellationActive()) return;
    this.centerLock = false;
    this.focus(id);
  }

  /**
   * 곡 하나에 포커스 — 그 곡으로 **확대하며** 들어간다 (검색 결과 클릭 등).
   * targetLayer 가 지금 레이어와 다르면 그 레이어로 먼저 전환(모프)한 뒤, 그 곡을 확대한 자리에서 시작한다.
   * targetLayer 는 "그 곡이 대표곡으로 노출되는 첫 레이어"다 (SEARCH-01).
   */
  focusSong(id: number, targetLayer?: number | null) {
    this.centerLock = false;
    if (this.follow || this.anim || !this.index.has(id)) return;
    this.selectedId = id;
    const s = this.songs[this.index.get(id)!];
    if (targetLayer == null || targetLayer === this.layer) {
      this.focus(id, FOCUS.zoomMul);
      return;
    }
    if (targetLayer < 0 || targetLayer >= LAYER_COUNT) return;
    // 다른 레이어의 대표곡이면 그 레이어로 전환하면서 그 곡을 확대해 보여준다
    const fr = this.freeRect();
    const scale = this.entryS * FOCUS.zoomMul;
    const cam: MapCamera = {
      s: scale,
      cx: s.pc[targetLayer * 2] - (fr.cx - this.W / 2) / scale,
      cy: s.pc[targetLayer * 2 + 1] + (fr.cy - this.H / 2) / scale,
    };
    const axes = axisLine(targetLayer);
    this.touched = true;
    this.morph(
      targetLayer,
      cam,
      this.subset,
      `${s.title} — ${LAYER_NAMES[targetLayer]}${ro(LAYER_NAMES[targetLayer])}`,
      axes,
      targetLayer > this.layer ? 1 : -1,
    );
  }

  /** 라벨 링크 위인가 — 히트 영역은 그리는 쪽이 적어 둔 것이다 */
  hitHopLink(mx: number, my: number): { id: number } | null {
    const l = this.hopLink;
    if (!l) return null;
    return mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h ? { id: l.id } : null;
  }

  startHold(id: number) {
    this.hold = { id, t0: performance.now() };
  }

  cancelHold() {
    this.hold = null;
  }

  /** 누르기 진행도 0~1 */
  holdK(now = performance.now()) {
    return this.hold ? Math.min(1, (now - this.hold.t0) / HOLD.ms) : 0;
  }

  /** 곡의 화면 자리 — 오버레이(주변 탐색·별자리)에 있으면 연출 자리, 아니면 지도 자리 */
  screenPosOf(id: number): { x: number; y: number } | null {
    const ov = this.probePos(id) ?? this.constellationPos(id);
    if (ov) return ov;
    const i = this.index.get(id);
    return i == null ? null : { x: this.pos[i * 2], y: this.pos[i * 2 + 1] };
  }

  /**
   * 튜토리얼이 "이 별을 눌러 보세요" 라고 짚을 별 하나 (S15P21A405-349).
   *
   * 지도가 실제로 보이는 사각형 안에서, 안내 카드에 가리지 않을 만큼 아래에 있는 별 중
   * 아무거나 고른다. 화면 밖이나 카드 뒤의 별을 짚으면 짚어 준 의미가 없다.
   *
   * **`freeRect` 만으로는 모자란다** (S15P21A405-350). 그건 우측 패널 폭만 빼 줄 뿐
   * 계기판·레일·플레이어바 같은 HUD 상자는 그 안에 그대로 들어 있다. 그 뒤에 깔린 별이
   * 뽑히면 구멍을 뚫어도 HUD 상자만 보인다 — `blocked` 로 상자를 한 번 더 걸러야 한다.
   *
   * 남은 것 중에서는 **밝은 쪽 절반**에서 뽑는다. 재생수가 적은 별은 점이 희미해서,
   * 짚어 줘도 눈에 안 들어온다.
   */
  pickTutorialStar(cardBottom: number): number | null {
    const f = this.freeRect();
    const ok = this.visible.filter(
      (v) =>
        v.px > f.x0 + 40 &&
        v.px < f.x1 - 40 &&
        v.py > Math.max(f.y0 + 40, cardBottom) &&
        v.py < f.y1 - 40 &&
        !this.blocked(v.px, v.py),
    );
    if (!ok.length) return null;
    const bright = [...ok].sort((a, b) => this.songs[b.i].weight - this.songs[a.i].weight).slice(0, Math.max(1, Math.ceil(ok.length / 2)));
    return this.songs[bright[Math.floor(Math.random() * bright.length)].i].musicId;
  }

  /** 그 별이 지금 화면 어디에 있나. 안 보이면 null — 카메라가 움직이면 매 프레임 달라진다 */
  starPos(musicId: number): { x: number; y: number; r: number } | null {
    const i = this.index.get(musicId);
    if (i == null) return null;
    const v = this.visible.find((x) => x.i === i);
    return v ? { x: v.px, y: v.py, r: v.r } : null;
  }

  hitTest(mx: number, my: number): VisibleStar | null {
    let best: VisibleStar | null = null;
    let bd = 1e9;
    // 오버레이(별자리·주변 탐색)가 떠 있으면 그 안의 곡만 잡힌다 — 어둡게 덮인 뒷별이 호버·클릭에
    // 걸리면 카드가 엉뚱한 곡으로 뜬다 (S15P21A405-288). 클릭 게이트와 같은 집합을 쓴다
    const gate = this.clickableOverlayIds();
    for (const v of this.visible) {
      if (gate && !gate.has(this.songs[v.i].musicId)) continue;
      const d = (v.px - mx) ** 2 + (v.py - my) ** 2;
      if (d < v.r * v.r && d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  /** 내 위치(우주선·헬멧)의 화면 좌표. 반응 이모지가 여기서 떠오른다 (SOCIAL-02) */
  mePos(): { x: number; y: number } | null {
    if (this.myId == null) return null;
    const { px, py } = this.worldToScreen(this.me.x, this.me.y);
    return { x: px, y: py };
  }

  /** 지도에 떠 있는 사용자의 화면 좌표. 내 뷰 안에 없으면 null (남의 반응은 그때만 보인다) */
  friendScreenPos(email: string): { x: number; y: number } | null {
    const f = this.visFriends.find((v) => v.user.email === email);
    return f ? { x: f.px, y: f.py } : null;
  }

  hitFriend(mx: number, my: number): VisibleFriend | null {
    for (const fr of this.visFriends) if ((fr.px - mx) ** 2 + (fr.py - my) ** 2 < 22 * 22) return fr;
    return null;
  }

  // ------------------------------------------------------------------ me / play / follow
  setMy(id: number | null) {
    if (id == null || !this.index.has(id)) return;
    this.myId = id;
    const w = this.worldOf(id)!;
    this.me = { ...w };
  }

  /**
   * 곡 재생 → 내 위치가 그 곡으로 걸어간다 (MAP-08).
   * 그 곡이 이 겹에 없으면 **움직이지 않고 있던 자리에 남는다** — 없는 곳으로 데려가지 않고,
   * 재생 때문에 레이어를 강제로 옮기지도 않는다. 대신 가생이에 옅은 점으로 방향만 뜬다.
   */
  travelTo(id: number) {
    /**
     * 이 겹에 없는 곡(주변 탐색에서 고른 이웃 곡 등)이어도 **자리는 기억한다.**
     * 기억해 두지 않으면 "내 위치로 가기" 가 한참 전에 재생한 딴 곡으로 데려간다 —
     * 화살표는 지금 곡 쪽을 가리키는데 버튼은 딴 데로 가니 안 먹은 것처럼 보인다.
     *
     * **지도가 아직 모르는 곡이어도 마찬가지다** (S15P21A405-328). 예전에는 그때 맨 앞에서
     * 빠져나가 `home` 이 이전 곡에 남았고, 버튼이 지금 듣는 곡이 아닌 데로 데려갔다.
     * 지금은 기록을 먼저 갈아 끼운다 — 그 곡을 지도가 모르면 `canGoHome` 이 false 라
     * 버튼이 꺼질 뿐이고, 곡이 도착하는 순간 제대로 살아난다.
     */
    this.playingId = id;
    this.home = { musicId: id, boxes: [...this.boxes] };
    // 자리가 바뀌었으니 앞서 못 박아 둔 곡은 놓아 준다
    if (this.pinned && this.pinned.id !== id) this.pinned = null;
    // 여기부터는 좌표가 있어야 한다 — 지도에 없는 곡은 데려갈 자리가 없다
    if (!this.index.has(id)) return;
    /**
     * 주변 탐색 중 **고리 안 곡**을 재생하면 정찰이다 (S15P21A405-288) — 우주선만 그 별의 고리 자리로
     * 건너뛰고 고리·카메라는 그대로다. 이웃은 대개 이 겹에 상주하지 않아(isAlive 가 아니라) 아래
     * 월드 비행으로는 어차피 못 가고, 상주하더라도 고리 자리와 실제 자리가 달라 엉뚱한 곳에 앉는다.
     * 월드 좌표(me)는 상주 곡이면 맞춰 둔다 — 고리를 닫았을 때 그 자리에 있어야 한다
     */
    if (this.probe && !this.probe.exitingAt && this.overlaySlot(id)) {
      const from = this.meScreen();
      this.meHop = { x: from.px, y: from.py, t0: performance.now() };
      this.meFlight = null;
      this.travelToId = null;
      this.myId = id;
      const w = this.worldOf(id);
      if (w && this.isAlive(id)) this.me = { ...w };
      return;
    }
    this.meHop = null;
    if (!this.isAlive(id)) {
      this.travelToId = null;
      return;
    }
    this.travelToId = id;
    this.centerLock = true;
    // 있던 자리에서 그 곡까지 곡선 비행 — 어디선가 날아오는 게 보이게
    const to = this.worldOf(id)!;
    const dx = to.x - this.me.x;
    const dy = to.y - this.me.y;
    const d = Math.hypot(dx, dy);
    this.meFlight = {
      ax: this.me.x,
      ay: this.me.y,
      bx: to.x,
      by: to.y,
      // 진행 방향의 수직으로 부풀린 제어점 (id 로 방향을 갈라 매번 같은 쪽으로 휘지 않게)
      cx: (this.me.x + to.x) / 2 - dy * ME_FLIGHT.bow * (id % 2 ? 1 : -1),
      cy: (this.me.y + to.y) / 2 + dx * ME_FLIGHT.bow * (id % 2 ? 1 : -1),
      t0: performance.now(),
    };
    if (d < 1e-6) this.meFlight = null;
    // 별자리 뷰가 떠 있는 동안에는 카메라를 건드리지 않는다 (닫으면 원래 자리로 돌아가야 하므로)
    if (!this.follow && !this.constellationActive()) this.focus(id);
  }

  /** 재생 중인 곡이 이 겹 밖인가 — 내 표식에 "다른 갈래에서 재생 중"을 붙일지 (MAP-08) */
  playingElsewhere() {
    return this.playingId != null && !this.isAlive(this.playingId);
  }

  // ------------------------------------------------------------------ 내 위치로 가기
  /**
   * 그 곡을 **지도 영역 한가운데**에 놓는다.
   *
   * `focus` 와 달리 상주 여부를 따지지 않는다 — "내 위치로 가기" 는 어떤 상황에서든 가운데여야 하고,
   * 서버가 고른 top-k 에서 빠졌더라도 좌표는 있기 때문이다.
   */
  private centerOn(id: number, scaleMul?: number) {
    const w = this.worldOf(id);
    if (!w) return;
    this.touched = true;
    const f = this.freeRect();
    const s = scaleMul ? Math.max(this.cam.s, this.entryS * scaleMul) : this.cam.s;
    this.camTarget = { s, cx: w.x - (f.cx - this.W / 2) / s, cy: w.y + (f.cy - this.H / 2) / s };
    this.centerLock = true;
  }

  /**
   * "내 위치로 가기" 로 데려다 놓은 곡을 **그 겹에 붙들어 둔다.**
   *
   * 서버 top-k 에 없는 곡일 수 있어서(주변 탐색에서 고른 이웃 곡이 그렇다) 그냥 두면 상주 집합
   * 응답이 도착하는 순간 도로 빠진다 — 카메라만 제자리고 표식은 다시 가생이 화살표가 된다.
   * 겹을 옮기면 그 겹의 규칙을 따라야 하므로 **못 박은 겹에서만** 유효하다.
   */
  private pinned: { id: number; layer: number } | null = null;

  /** 못 박은 곡을 이 겹 상주 마스크에 되살린다 */
  private keepPinned(mask: Uint8Array, layer: number) {
    if (!this.pinned || this.pinned.layer !== layer) return;
    const i = this.index.get(this.pinned.id);
    if (i != null) mask[i] = 1;
  }

  /**
   * "내 위치로 가기" 로 도착한 자리에 '나'를 앉힌다.
   *
   * 명시적으로 누른 버튼이므로, 그 곡이 이 겹 상주 집합에 없더라도 그 한 곡만 끼워 넣고
   * '나'를 그 자리로 옮긴다 — 카메라만 가고 표식은 딴 데 있으면 "안 갔다" 로 보인다.
   */
  private settleHome(i: number) {
    const id = this.songs[i].musicId;
    this.pinned = { id, layer: this.layer };
    if (!this.subset[i]) {
      this.subset[i] = 1;
      this.alpha[i] = 1;
      this.rebuildAliveIdx();
      this.project();
    }
    this.myId = id;
    this.me = { ...this.worldOf(id)! };
    this.meFlight = null;
  }

  /** 돌아갈 자리가 있는가 (재생한 적이 있는가) */
  canGoHome() {
    return this.home != null && this.index.has(this.home.musicId);
  }

  /**
   * 누적 범위 `boxes` 를 layer 까지 적용했을 때의 상주 마스크.
   * 서버가 고르는 top-k 까지는 알 수 없으므로 **범위 조건만** 건다 — 응답이 오면 갈아끼워진다.
   */
  private maskForBoxes(boxes: readonly LayerBox[], upTo: number) {
    const m = this.residentMask(upTo);
    for (let i = 0; i < this.N; i++) {
      if (!m[i]) continue;
      const pc = this.songs[i].pc;
      for (let l = 0; l < upTo; l++) {
        const b = boxes[l];
        const x = pc[b.layer * 2];
        const y = pc[b.layer * 2 + 1];
        if (x < b.xMin || x > b.xMax || y < b.yMin || y > b.yMax) {
          m[i] = 0;
          break;
        }
      }
    }
    return m;
  }

  /**
   * 재생으로 내 위치가 정해졌던 **그 겹·그 화면**으로 돌아간다.
   *
   * 같은 겹이면 카메라만 옮긴다. 다른 겹이면 누적 범위를 그때 것으로 되돌리고 겹 전환 연출을 태운다 —
   * 범위가 바뀌면 그 조건으로 상주 집합을 다시 받아오고, 도착하면 `setLayerSongs` 가 갈아끼운다.
   * 떠오르기가 계속 되도록 상위 겹 프레임도 누적 범위로 다시 쌓는다.
   */
  goHome(): GoHomeResult {
    const h = this.home;
    if (!h) return "none";
    const i = this.index.get(h.musicId);
    if (i == null) return "none";
    // 따라가기 중에는 화면을 직접 조작하지 않는다 (SOCIAL-08)
    if (this.follow) return "follow";
    /**
     * 임시 뷰(주변 탐색·별자리)가 떠 있으면 **지도를 움직이지 않는다.**
     * 그 뷰가 화면을 차지하고 곡들을 연출 위치로 끌어다 놓기 때문에, 가 봐야 내 자리가 보이지 않는다.
     * 대신 왜 안 되는지 알려 줄 수 있게 이유를 돌려준다.
     */
    if ((this.probe && !this.probe.exitingAt) || this.constellationActive()) return "overlay";
    // 겹을 건너는 중이면 끝난 뒤에 처리한다 — 누른 게 묻히지 않게
    if (this.anim) {
      this.pendingHome = true;
      return "queued";
    }
    this.ghost = null;
    this.camTarget = null;
    const target = h.boxes.length;

    // 같은 겹이면 카메라만 — 곡 집합을 다시 받을 이유가 없다
    if (target === this.layer) {
      this.settleHome(i);
      this.centerOn(h.musicId, FOCUS.zoomMul);
      return "moved";
    }

    const ns = this.maskForBoxes(h.boxes, target);
    // 서버 top-k 에서 빠졌더라도 돌아갈 자리는 보여야 한다 — 응답이 와도 빠지지 않게 못 박는다
    this.pinned = { id: h.musicId, layer: target };
    ns[i] = 1;
    // 떠오르기용 상위 겹 프레임 재구성 (지금 스택은 다른 길로 파고든 것이라 쓸 수 없다)
    this.stack = Array.from({ length: target }, (_, l) => {
      const sub = this.maskForBoxes(h.boxes, l);
      // 다른 길로 파고든 스택을 버리고 새로 쌓는 자리다 — 그 겹의 맞춤 배율이 곧 진입 배율이다
      const cam = this.fitCam(l, sub, h.musicId);
      return { layer: l, cam, subset: sub, entryS: cam.s };
    });
    this.boxes = [...h.boxes];

    const song = this.songs[i];
    this.centerAfterMorph = h.musicId;
    // 도착하면 '나'도 그 자리에 앉는다 — 모프 끝에서 me 가 myId 로 맞춰진다
    this.myId = h.musicId;
    this.meFlight = null;
    const scale = this.fitCam(target, ns, h.musicId).s * FOCUS.zoomMul;
    const f = this.freeRect();
    const axes = axisLine(target);
    this.touched = true;
    this.morph(
      target,
      { s: scale, cx: song.pc[target * 2] - (f.cx - this.W / 2) / scale, cy: song.pc[target * 2 + 1] + (f.cy - this.H / 2) / scale },
      ns,
      `내 위치로 — ${LAYER_NAMES[target]}${ro(LAYER_NAMES[target])} 돌아가는 중`,
      axes,
      target > this.layer ? 1 : -1,
    );
    return "moved";
  }

  /**
   * 레이어 0(전 우주)까지 떠오른 뒤 그 곡을 확대한다 (MAP-12 "이 곡이 있는 곳으로 가기").
   * 파고든 경로를 버리는 큰 이동이라 사용자가 명시적으로 눌렀을 때만 부른다.
   */
  surfaceToSong(id: number) {
    if (this.follow || this.anim || !this.index.has(id)) return;
    // 도착 겹(레이어 0)의 상주 집합으로 되돌린다 — 처음 받아 둔 그 집합이고, 그 겹에는 이 곡도 있다
    const ns = this.stack[0]?.subset ?? this.subset.slice();
    this.stack = [];
    this.boxes = [];
    this.selectedId = id;
    const axes = axisLine(0);
    const scale = this.fitCam(0, ns, id).s * FOCUS.zoomMul;
    const f = this.freeRect();
    const s = this.songs[this.index.get(id)!];
    // 내 위치는 건드리지 않는다 — 내 자리는 재생 중인 곡이지 지금 보러 간 곡이 아니다 (MAP-08)
    this.morph(
      0,
      { s: scale, cx: s.pc[0] - (f.cx - this.W / 2) / scale, cy: s.pc[1] + (f.cy - this.H / 2) / scale },
      ns,
      `${s.title} — ${LAYER_NAMES[0]}${ro(LAYER_NAMES[0])} 떠오르는 중`,
      axes,
      -1,
    );
  }

  startFollow(leader: NearbyUser) {
    if (!this.index.has(leader.musicId)) return;
    this.travelToId = null;
    this.camTarget = null;
    // 별자리는 다른 활동이므로 함께 사라진다 (ACT-01)
    this.constellation = null;
    this.route = [];
    const viewingMusicId = this.index.has(leader.viewingMusicId) ? leader.viewingMusicId : leader.musicId;
    this.follow = {
      leader,
      viewingMusicId,
      playingMusicId: leader.musicId,
      // 탑승 직후엔 인솔자가 이미 보고 있는 곡이 있으므로, 다음 동작은 그 곡의 재생이다
      phase: "play",
      nextAt: performance.now() + FOLLOW.viewToPlayMs,
      hops: 0,
      mv: null,
      visited: [],
    };
    this.onLeaderViewingChange?.(viewingMusicId);
  }

  stopFollow() {
    if (!this.follow) return;
    const f = this.follow;
    this.follow = null;
    const w = this.worldOf(f.mv?.toId ?? f.leader.musicId);
    if (w) {
      this.me = { ...w };
      this.myId = f.mv?.toId ?? f.leader.musicId;
    }
  }
  /**
   * 인솔자의 다음 동작을 진행한다 (목: 랜덤. 실서비스: 소켓 이벤트로 대체).
   *  phase "view" → 인솔자가 새 곡을 클릭한다. 뷰만 그리로 간다.
   *  phase "play" → 인솔자가 그 곡을 재생한다. 우주선이 날아온다. 뷰는 그대로.
   * 가끔 인솔자가 레이어를 바꾸면 따라가는 사람도 같은 레이어로 전환된다.
   */
  private stepLeader(now: number) {
    const f = this.follow!;
    if (f.phase === "view") this.leaderPicksSong(now, f);
    else this.leaderPlaysSong(now, f);
  }

  /** ① 인솔자가 곡을 클릭해 상세를 본다 — 내 뷰가 먼저 이동한다 */
  private leaderPicksSong(now: number, f: FollowState) {
    f.hops++;
    if (f.hops > FOLLOW.maxHops) {
      const who = f.leader.nickname ?? "인솔자";
      // 엔진에서 먼저 끊는다. 안 그러면 콜백이 매 프레임 다시 불린다
      this.stopFollow();
      this.onFollowEnd?.(`${who} 님이 접속을 종료해 따라가기가 끝났습니다.`);
      return;
    }
    // 인솔자가 레이어를 옮기는 차례
    if (f.hops > 1 && f.hops % FOLLOW.layerChangeEvery === 0 && this.leaderChangesLayer(f)) return;

    const from = this.friendPos.get(f.leader.email) ?? this.worldOf(f.playingMusicId);
    if (!from) return;
    const next = this.pickNearbySong(from, f.viewingMusicId, f.playingMusicId);
    if (next == null) return;
    f.viewingMusicId = next;
    f.phase = "play";
    f.nextAt = now + FOLLOW.viewToPlayMs;
    this.onLeaderViewingChange?.(next);
  }

  /** ② 인솔자가 보고 있던 곡을 재생한다 — 우주선이 그 방향에서 날아온다. 뷰는 고정 */
  private leaderPlaysSong(now: number, f: FollowState) {
    const target = this.worldOf(f.viewingMusicId);
    const known = this.friendPos.get(f.leader.email);
    const from = known ?? this.worldOf(f.playingMusicId);
    if (!target || !from) return;
    const side = Math.random() < 0.5 ? 1 : -1;
    const L = Math.hypot(target.x - from.x, target.y - from.y) || 1e-6;
    f.mv = {
      ax: from.x,
      ay: from.y,
      bx: target.x,
      by: target.y,
      cx: (from.x + target.x) / 2 - ((target.y - from.y) / L) * L * 0.35 * side,
      cy: (from.y + target.y) / 2 + ((target.x - from.x) / L) * L * 0.35 * side,
      t0: now,
      dur: FOLLOW.moveMs,
      toId: f.viewingMusicId,
    };
    f.visited.push(f.viewingMusicId);
    f.phase = "view";
    f.nextAt = now + FOLLOW.moveMs + FOLLOW.playToViewMs;
    this.onArrive?.(f.viewingMusicId);
  }

  /** 인솔자가 레이어를 바꾼다 — 따라가는 사람도 같은 레이어로 전환 (모프) */
  private leaderChangesLayer(f: FollowState): boolean {
    const dir = this.layer >= LAYER_COUNT - 1 ? -1 : this.layer <= 0 ? 1 : Math.random() < 0.6 ? 1 : -1;
    const target = this.layer + dir;
    if (target < 0 || target >= LAYER_COUNT) return false;
    const axes = axisLine(target);
    const view = { x: this.songs[this.index.get(f.viewingMusicId)!].pc[target * 2], y: this.songs[this.index.get(f.viewingMusicId)!].pc[target * 2 + 1] };
    const fr = this.freeRect();
    const s = this.entryS * FOLLOW.zoomMul;
    const cam: MapCamera = { s, cx: view.x - (fr.cx - this.W / 2) / s, cy: view.y + (fr.cy - this.H / 2) / s };
    // 인솔자를 따라 겹을 옮겨도 누적 범위는 맞춰 둔다 (그 겹 상주 집합을 받아야 하므로)
    this.boxes = dir > 0 ? [...this.boxes, this.viewBox()] : this.boxes.slice(0, target);
    // 우주선·내 위치는 새 레이어 좌표로 옮긴다
    this.friendPos.delete(f.leader.email);
    this.morph(target, cam, this.subset, `${f.leader.nickname ?? "인솔자"} 님을 따라 ${LAYER_NAMES[target]}${ro(LAYER_NAMES[target])}`, axes);
    f.phase = "view";
    f.nextAt = performance.now() + DRILL.morphMs + FOLLOW.playToViewMs;
    return true;
  }

  /** 지금 위치 기준 가까운 상주 곡 하나 (직전 곡들은 제외) */
  private pickNearbySong(from: { x: number; y: number }, ...exclude: number[]): number | null {
    const skip = new Set(exclude);
    const cands: { i: number; d: number }[] = [];
    for (let i = 0; i < this.N; i++) {
      if (!this.subset[i] || !this.songs[i].playable) continue;
      const s = this.songs[i];
      if (skip.has(s.musicId)) continue;
      const d = Math.hypot(s.pc[this.dx()] - from.x, s.pc[this.dy()] - from.y);
      if (d < 0.02) continue;
      cands.push({ i, d });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.d - b.d);
    const pool = cands.slice(0, 8);
    return this.songs[pool[Math.floor(Math.random() * pool.length)].i].musicId;
  }

  // ------------------------------------------------------------------ frame
  frame(now: number) {
    this.time = now / 1000;
    if (!this.inited) return;

    // 패널 폭을 부드럽게 따라간다 (사이드 패널 열고 닫을 때 화면이 끊기며 튀지 않게)
    if (this.occludedRight !== this.occludedTarget) {
      this.occludedRight = lerp(this.occludedRight, this.occludedTarget, OCCLUSION_EASE);
      if (Math.abs(this.occludedRight - this.occludedTarget) < 0.5) this.occludedRight = this.occludedTarget;
    }

    /**
     * 가운데 고정. 패널이 열리고 닫히면 `occludedRight` 가 부드럽게 변하므로,
     * 여기서 매 프레임 다시 맞추면 '나'도 그 속도로 자연스럽게 따라간다.
     * 배율은 건드리지 않는다 — 가운데로 "옮기는" 것이지 확대하는 게 아니다.
     */
    const viewBusy = (!!this.probe && !this.probe.exitingAt) || this.constellationActive();
    if (this.centerLock && !this.camTarget && !this.anim && !this.follow && !viewBusy) {
      const id = this.playingId ?? this.myId;
      const w = id != null ? this.worldOf(id) : null;
      if (w) {
        const f = this.freeRect();
        const cx = w.x - (f.cx - this.W / 2) / this.cam.s;
        const cy = w.y + (f.cy - this.H / 2) / this.cam.s;
        if (Math.abs(cx - this.cam.cx) * this.cam.s > 0.4 || Math.abs(cy - this.cam.cy) * this.cam.s > 0.4) {
          this.cam.cx = lerp(this.cam.cx, cx, OCCLUSION_EASE);
          this.cam.cy = lerp(this.cam.cy, cy, OCCLUSION_EASE);
          this.project();
        }
      }
    }

    // 모프 진행 — 두 겹을 화면 중앙 기준으로 확대·축소하며 교차한다 (별을 새 자리로 옮기지 않는다)
    if (this.anim) {
      const fade = this.anim.mode === "fade";
      const t = Math.min(1, (now - this.anim.t0) / (fade ? DRILL.swapMs : DRILL.morphMs));
      const e = easeInOut(t);
      const f = this.freeRect();
      const dir = this.anim.dir;
      // 나가는 겹: 파고들면 계속 확대, 떠오르면 줄어든다. 들어오는 겹은 그 반대쪽에서 제 크기로 온다
      // 나가는 겹은 뒤로 갈수록 가속해 화면 밖으로 빠진다 (후욱). fade 모드는 자리를 그대로 둔다
      const eOut = Math.pow(e, DRILL.dive.outEase);
      const sOut = fade ? 1 : dir > 0 ? lerp(1, DRILL.dive.out, eOut) : lerp(1, DRILL.dive.in, eOut);
      const sIn = fade ? 1 : dir > 0 ? lerp(DRILL.dive.in, 1, e) : lerp(DRILL.dive.out, 1, e);
      // 두 겹이 겹쳐 있는 구간을 넉넉히 둔다 — 안 그러면 전환 중간이 텅 비어 깜빡인다.
      // 들어오는 겹은 일찍 드러나야 "다음 겹으로 이어진다" 로 읽힌다 (S15P21A405-284)
      this.morphT = e;
      const aOut = fade ? 1 - e : Math.pow(1 - e, 1.15);
      const aIn = fade ? e : Math.min(1, Math.max(0, e / 0.42));
      for (let i = 0; i < this.N; i++) {
        this.posOut[i * 2] = f.cx + (this.from[i * 2] - f.cx) * sOut;
        this.posOut[i * 2 + 1] = f.cy + (this.from[i * 2 + 1] - f.cy) * sOut;
        this.alphaOut[i] = this.aFrom[i] * aOut;
        this.pos[i * 2] = f.cx + (this.to[i * 2] - f.cx) * sIn;
        this.pos[i * 2 + 1] = f.cy + (this.to[i * 2 + 1] - f.cy) * sIn;
        this.alpha[i] = this.aTo[i] * aIn;
      }
      if (t >= 1) {
        const a = this.anim;
        this.anim = null;
        this.layer = a.layer;
        this.cam = a.cam;
        // 떠오르기는 **그 겹에 원래 들어왔던 배율**로 되돌린다 — 떠날 때 확대돼 있던 배율을
        // 진입 배율로 삼으면 그 겹의 줌아웃 한계가 그만큼 올라간다 (S15P21A405-271)
        this.entryS = a.entryS ?? a.cam.s;
        this.subset = a.subset;
        this.rebuildAliveIdx();
        this.alpha = this.aTo.slice();
        this.alphaOut.fill(0);
        this.morphT = 0;
        const w = this.myId != null ? this.worldOf(this.myId) : null;
        if (w) this.me = { ...w };
        if (this.selectedId != null && !this.isAlive(this.selectedId)) this.selectedId = null;
        this.project();
        // 내 위치로 가기: 응답이 중간에 도착해 카메라가 덮였을 수 있으므로 마지막에 가운데로 잡는다
        if (this.centerAfterMorph != null) {
          const id = this.centerAfterMorph;
          this.centerAfterMorph = null;
          this.centerOn(id, FOCUS.zoomMul);
        }
        // 전환 중에 눌린 "내 위치로 가기" 를 이제 처리한다
        if (this.pendingHome) {
          this.pendingHome = false;
          this.goHome();
        }
      }
    } else {
      if (this.pending) {
        // 기다리는 동안 멈추지 않는다 — 지금 겹을 천천히 계속 확대해 "줌인이 이어지는 중" 으로 읽히게 하고,
        // 집합이 오면 그 자리에서 다이빙이 이어진다 (출발 자리 = 지금 자리). 멈춰 있으면 끊긴 것처럼 보인다
        const k = 1 + DRILL.waitZoom * (1 - Math.exp(-(now - this.pending.since) / DRILL.waitZoomTauMs));
        this.cam.s = this.pending.s0 * k;
        this.project();
        this.tryStartPending(now);
      } else if (this.pressure > 0) {
        this.pressure = Math.max(0, this.pressure - DRILL.pressureDecay);
        if (this.pressure === 0) this.prefetch = null;
      }
      // 별자리 안에서 그 곡으로 다가가기 (S15P21A405-330). 목표 자리는 영역이 바뀔 수 있어 매 프레임 다시 잰다
      if (this.overlayFocusId != null) {
        const t = this.overlayDest(this.overlayFocusId, this.overlayFocusZoom);
        if (!t || !this.constellationActive()) this.overlayFocusId = null;
        else {
          const o = this.overlay;
          const k = 1 - Math.pow(0.001, 16 / 1000) * 0.85;
          o.zoom = lerp(o.zoom, this.overlayFocusZoom, k);
          o.dx = lerp(o.dx, t.dx, k);
          o.dy = lerp(o.dy, t.dy, k);
          // 마지막 반 픽셀은 붙여 버린다 — 보간만으로는 영영 안 닿고 매 프레임 계산이 남는다
          if (Math.abs(o.dx - t.dx) < 0.5 && Math.abs(o.dy - t.dy) < 0.5 && Math.abs(o.zoom / this.overlayFocusZoom - 1) < 0.002) {
            o.zoom = this.overlayFocusZoom;
            o.dx = t.dx;
            o.dy = t.dy;
            this.overlayFocusId = null;
          }
          this.clampOverlay();
        }
      }
      // 카메라 목표 추적
      if (this.camTarget) {
        const k = 1 - Math.pow(0.001, 16 / 1000) * 0.85;
        this.cam.cx = lerp(this.cam.cx, this.camTarget.cx, k);
        this.cam.cy = lerp(this.cam.cy, this.camTarget.cy, k);
        this.cam.s = this.cam.s * Math.pow(this.camTarget.s / this.cam.s, k);
        if (Math.abs(this.cam.cx - this.camTarget.cx) * this.cam.s < 0.3 && Math.abs(this.cam.cy - this.camTarget.cy) * this.cam.s < 0.3 && Math.abs(this.cam.s / this.camTarget.s - 1) < 0.002) {
          this.cam = { ...this.camTarget };
          this.camTarget = null;
        }
        this.project();
      }
      // '나'의 비행 — 재생한 곡까지 곡선을 타고 간다
      if (this.travelToId != null && !this.follow) {
        const w = this.worldOf(this.travelToId);
        if (!w || !this.isAlive(this.travelToId)) {
          this.travelToId = null;
          this.meFlight = null;
        } else if (this.meFlight) {
          const fl = this.meFlight;
          const t = Math.min(1, (now - fl.t0) / ME_FLIGHT.ms);
          const e2 = easeInOut(t);
          const q = 1 - e2;
          this.me.x = q * q * fl.ax + 2 * q * e2 * fl.cx + e2 * e2 * fl.bx;
          this.me.y = q * q * fl.ay + 2 * q * e2 * fl.cy + e2 * e2 * fl.by;
          if (t >= 1) {
            this.me = { x: fl.bx, y: fl.by };
            this.myId = this.travelToId;
            this.travelToId = null;
            this.meFlight = null;
          }
        } else {
          this.me = { ...w };
          this.myId = this.travelToId;
          this.travelToId = null;
        }
      }
      this.stepFollow(now);
    }

    // 커버·프로필 페이드: 모프 중이거나 데이터가 아직 이전 레이어 것이면 사라지고, 새 레이어 데이터가 오면 서서히 나타난다
    // 오버레이 해제 애니메이션이 끝나면 정리. **둘 다 지운다** — 별자리를 안 지우면 닫힌 뒤에도
    // 그 곡 집합이 남아서 클릭 게이트가 계속 걸리고, 지도의 별이 영영 안 눌린다 (S15P21A405-270)
    if (this.probe?.exitingAt && now - this.probe.exitingAt > PROBE.exitMs) this.probe = null;
    // 밀려난 고리는 다 옅어진 뒤 뗀다
    if (this.probe) this.probe.rings = this.probe.rings.filter((r) => !r.leavingAt || now - r.leavingAt <= PROBE.exitMs);
    if (this.constellation?.exitingAt && now - this.constellation.exitingAt > CONSTELLATION.exitMs) this.constellation = null;
    const probing = !!this.probe && !this.probe.exitingAt;
    const coverTarget = !this.anim && !probing && this.repLayer === this.layer ? 1 : 0;
    const friendTarget = !this.anim && !probing && this.friendsLayer === this.layer ? 1 : 0;
    const fadeK = coverTarget ? 0.045 : 0.16; // 사라질 땐 빠르게, 나타날 땐 천천히
    this.coverAlpha += (coverTarget - this.coverAlpha) * fadeK;
    this.friendAlpha += (friendTarget - this.friendAlpha) * (friendTarget ? 0.045 : 0.16);
    if (Math.abs(this.coverAlpha - coverTarget) < 0.005) this.coverAlpha = coverTarget;
    if (Math.abs(this.friendAlpha - friendTarget) < 0.005) this.friendAlpha = friendTarget;

    this.updateReveal();
    this.updateFriends();
    if (!this.anim) this.pickRepresentatives();
    this.publish();
  }

  private stepFollow(now: number) {
    const f = this.follow;
    if (!f) return;
    if (!f.mv && !this.anim && now >= f.nextAt) this.stepLeader(now);
    // 뷰는 인솔자가 "보고 있는 곡"만 좇는다. 우주선이 날아오는 동안(mv)에는 고정 (SOCIAL-07)
    if (!f.mv) this.trackViewing(f);
    if (!f.mv) return;
    const m = f.mv;
    const t = Math.min(1, (now - m.t0) / m.dur);
    const e = easeInOut(t);
    const q = 1 - e;
    const x = q * q * m.ax + 2 * q * e * m.cx + e * e * m.bx;
    const y = q * q * m.ay + 2 * q * e * m.cy + e * e * m.by;
    const hx = 2 * q * (m.cx - m.ax) + 2 * e * (m.bx - m.cx);
    const hy = 2 * q * (m.cy - m.ay) + 2 * e * (m.by - m.cy);
    this.friendPos.set(f.leader.email, { x, y, heading: Math.atan2(hy, hx) });
    // 나는 선미 바로 뒤
    const back = Math.max(0, e - 0.06);
    const qb = 1 - back;
    this.me.x = qb * qb * m.ax + 2 * qb * back * m.cx + back * back * m.bx;
    this.me.y = qb * qb * m.ay + 2 * qb * back * m.cy + back * back * m.by;
    this.project();
    if (t >= 1) {
      f.mv = null;
      f.playingMusicId = m.toId;
      f.leader = { ...f.leader, musicId: m.toId };
      this.myId = m.toId;
    }
  }

  /** 뷰포트를 인솔자가 보고 있는 곡으로. 배율도 따라가기 배율로 맞춘다 (SOCIAL-07) */
  private trackViewing(f: FollowState) {
    const view = this.worldOf(f.viewingMusicId);
    if (!view) return;
    const fr = this.freeRect();
    const targetS = this.entryS * FOLLOW.zoomMul;
    this.cam.s = this.cam.s * Math.pow(targetS / this.cam.s, 0.06);
    this.cam.cx = lerp(this.cam.cx, view.x - (fr.cx - this.W / 2) / this.cam.s, 0.06);
    this.cam.cy = lerp(this.cam.cy, view.y + (fr.cy - this.H / 2) / this.cam.s, 0.06);
    this.project();
  }

  private updateFriends() {
    this.visFriends = [];
    const f = this.freeRect();
    const G = 58;
    const occ = new Set<string>();
    const capN = MAP_FRIENDS_MAX;
    const list = this.follow ? [this.follow.leader, ...this.friends.filter((x) => x.email !== this.follow!.leader.email)] : this.friends;
    for (const u of list) {
      if (this.visFriends.length >= capN) break;
      if (!u.isOnline || !u.isPublic) continue;
      const isLeader = this.follow?.leader.email === u.email;
      let w = this.friendPos.get(u.email);
      if (!w || !isLeader) {
        const base = this.anchorFor(u);
        if (!base) continue;
        w = w && isLeader ? w : { x: base.x, y: base.y, heading: w?.heading ?? ((u.avatarSeed[0] ?? 0.5) * Math.PI * 2) };
        this.friendPos.set(u.email, w);
      }
      const { px, py } = this.worldToScreen(w.x, w.y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      if (!isLeader && (px < 20 || px > f.x1 - 20 || py < 76 || py > this.H - 104)) continue;
      const key = `${Math.floor(px / G)},${Math.floor(py / G)}`;
      if (!isLeader) {
        let clash = false;
        for (let a = -1; a <= 1 && !clash; a++) for (let b = -1; b <= 1; b++) if (occ.has(`${Math.floor(px / G) + a},${Math.floor(py / G) + b}`)) clash = true;
        if (clash) continue;
      }
      occ.add(key);
      this.visFriends.push({ user: u, px, py, heading: w.heading, isLeader });
    }
  }

  /**
   * 상주 집합 마스크. ghostOnly 곡(목 확인용)은 **레이어 0 에만** 있다 —
   * 레이어 0 은 전 우주라 모든 곡이 있고, 파고들면 빠지는 게 실제 규칙이다.
   */
  private residentMask(layer = this.layer) {
    const m = new Uint8Array(this.N);
    for (let i = 0; i < this.N; i++) m[i] = this.songs[i].ghostOnly && layer > 0 ? 0 : 1;
    return m;
  }

  /** 이 겹에 상주하는 곡 수 */
  residentCount() {
    let n = 0;
    for (let i = 0; i < this.N; i++) n += this.subset[i];
    return n;
  }

  /**
   * 화면 안에 담긴 상주 곡 수 — 다음 겹의 기준이다.
   * 게이트 판정이 프레임 갱신을 기다리지 않게 필요할 때 바로 센다 (1,000곡 순회는 가볍다).
   */
  countInView() {
    const f = this.freeRect();
    let n = 0;
    for (let i = 0; i < this.N; i++) {
      if (!this.subset[i]) continue;
      const px = this.pos[i * 2];
      const py = this.pos[i * 2 + 1];
      if (px >= f.x0 && px <= f.x1 && py >= f.y0 && py <= f.y1) n++;
    }
    return n;
  }

  /** 프레임마다 HUD 용 값 갱신 */
  private updateReveal() {
    this.viewportCount = this.countInView();
    // 고스트별·화면 밖 '나' 는 구름을 감싸는 원 밖에 놓아야 하므로 그 반지름을 프레임마다 잰다
    this.cloudExtent = this.starRadius();
  }

  /** 대표곡 선별 — 격자를 월드에 못박아 팬해도 승자가 바뀌지 않게 */
  private pickRepresentatives() {
    this.visible = [];
    this.chosen = new Set();
    const gw = REPRESENTATIVE_GRID_PX / this.cam.s;
    const occ = new Set<string>();
    const dx = this.dx();
    const dy = this.dy();
    for (const i of this.byWeight) {
      if (!this.subset[i] || this.alpha[i] < 0.5) continue;
      const px = this.pos[i * 2];
      const py = this.pos[i * 2 + 1];
      if (px < -20 || px > this.W + 20 || py < -20 || py > this.H + 20) continue;
      const s = this.songs[i];
      const key = `${Math.floor(s.pc[dx] / gw)},${Math.floor(s.pc[dy] / gw)}`;
      if (occ.has(key)) continue;
      occ.add(key);
      this.chosen.add(i);
      this.visible.push({ i, px, py, r: 15 });
    }
    // 선택·경로·주변 탐색 결과는 간격과 무관하게 항상 집을 수 있다
    const extra = new Set<number>();
    if (this.selectedId != null) extra.add(this.selectedId);
    if (this.constellation) for (const id of this.constellation.ids) extra.add(id);
    if (this.probe) for (const id of this.probeIdSet(true)!) extra.add(id);
    for (const id of extra) {
      const i = this.index.get(id);
      if (i == null) continue;
      // 연출 위치가 있으면 상주 곡이 아니어도 집을 수 있다 (주변 탐색 이웃은 지도 집합 밖이다)
      const pp = this.probePos(id) ?? this.constellationPos(id);
      if (!pp && !this.subset[i]) continue;
      if (pp) {
        // 프로브 곡은 연출 위치로 히트테스트 (격자 대표곡이어도 위치를 덮어쓴다)
        const k = this.visible.findIndex((v) => v.i === i);
        if (k >= 0) this.visible.splice(k, 1);
        this.visible.push({ i, px: pp.x, py: pp.y, r: 16 });
        continue;
      }
      if (this.chosen.has(i)) continue;
      this.visible.push({ i, px: this.pos[i * 2], py: this.pos[i * 2 + 1], r: 14 });
    }
  }

  private publish() {
    const snap: Partial<EngineSnapshot> = {
      layer: this.layer,
      // 파고들기·떠오르기 때만 새 배열이 되므로 참조 비교로 변화가 잡힌다
      boxes: this.boxes,
      residentCount: this.residentCount(),
      viewportCount: this.viewportCount,
      zoomK: Math.round(this.zoomK() * 100) / 100,
      gateProgress: this.gateProgress(),
      gateAtCount: Math.round(this.gateMaxInView()),
      gateOpen: !this.anim && !this.pending && this.gateOpen(),
      atBottom: this.layer >= LAYER_COUNT - 1,
      canRise: this.stack.length > 0,
      pressure: Math.round(this.pressure * 100) / 100,
      pressureDir: this.pressure > 0.01 ? this.pressureDir : 0,
      // 압력 시작·해제 때만 새 배열이 되므로 참조 비교로 변화가 잡힌다
      prefetchBoxes: this.prefetch,
      morph: this.anim
        ? { big: this.anim.big, sub: this.anim.sub }
        : this.pending
          ? { big: `${LAYER_NAMES[this.layer + 1]} 불러오는 중`, sub: `화면 안 ${this.pending.inView.toLocaleString()}곡 기준` }
          : null,
      myMusicId: this.myId,
      // travelTo 때만 새 객체가 되므로 참조 비교로 변화가 잡힌다
      home: this.home,
      ghostMusicId: this.ghost?.musicId ?? null,
      playingElsewhere: this.playingElsewhere(),
      canGoHome: this.canGoHome(),
    };
    const changed = (Object.keys(snap) as (keyof EngineSnapshot)[]).some((k) => {
      const a = snap[k];
      const b = this.lastSnap[k];
      if (k === "morph") return (a as { big: string } | null)?.big !== (b as { big: string } | null)?.big;
      return a !== b;
    });
    if (changed) {
      this.lastSnap = { ...this.lastSnap, ...snap };
      this.snapListener?.({ ...snap, camera: { ...this.cam } });
    }
  }

}
