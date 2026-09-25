"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Occlusion } from "@/components/map/engine/map-engine";
import { CONSTELLATION, COVER_COUNT, HOLD, HOVER_CARD, NO_GENRE_ID, PINCH, PROBE, REPRESENTATIVE_COUNT, RIDE_LOCK_TOAST_MS, RIDING_LOCKED, RIDING_MAP_LOCKED, STORAGE_KEYS, WHEEL_ZOOM } from "@/constants";
import { BREAKPOINTS } from "@/constants/design-tokens";
import type { LayerBox, MapPoint } from "@/types";
import { useConstellationLayoutQuery } from "@/hooks/queries/use-constellation-layout-query";
import { useMapSongsQuery } from "@/hooks/queries/use-map-songs-query";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useNearbyQuery } from "@/hooks/queries/use-nearby-query";
import { useBots } from "@/hooks/use-bots";
import { useDeclarePlay } from "@/hooks/use-declare-play";
import { seedOf, useViewportSubscription } from "@/hooks/use-viewport-subscription";
import { useFeatures } from "@/hooks/use-features";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { usePlaySong } from "@/hooks/use-play-song";
import { readStorage, writeStorage } from "@/lib/storage";
import { isRiding, useFollowStore } from "@/stores/use-follow-store";
import { useUnplayableStore } from "@/stores/use-unplayable-store";
import { useJourneyStore } from "@/stores/use-journey-store";
import { rememberMusicHints } from "@/lib/music-hints";
import { useMapStore } from "@/stores/use-map-store";
import { useToastStore } from "@/stores/use-toast-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { registerMapEngine } from "./engine/engine-registry";
import { MapEngine } from "./engine/map-engine";
import HoverCard from "./hover-card";
import LayerToast from "./layer-toast";
import MapCanvas from "./map-canvas";
import { shouldFollowPlayback } from "./selection-follow";
import StarfieldPlaceholder from "./starfield-placeholder";
import { useViewport } from "./use-viewport";
import { ANALYTICS } from "@/constants/analytics";
import { analyticsContext, track, trackOnce } from "@/lib/analytics/client";
import { nearbyResults } from "@/lib/analytics/flows";
import { albumCover } from "./render/cover-art";
import { byCoverPriority } from "./render/cover-spread";
import { COVER_PX } from "./render/sprites";

interface MapViewProps {
  /** 우측 패널·레일 등으로 가려진 폭(px). 중앙 계산에서 제외한다 */
  occlusion: Occlusion;
}

/**
 * 스테이지 전체를 채우는 별지도. 엔진을 소유하고 스토어/쿼리와 엔진을 연결한다.
 * 입력: 휠 = 확대(게이트 열리면 압력 → 파고들기/떠오르기) · 드래그 = 이동 · 클릭 = 그 곡 상세(뷰만 이동) / 친구 프로필
 *
 * **보는 곡과 내 위치는 다른 값이다** (S15P21A405-277). 클릭은 보는 곡만 바꾸고, 내 위치(우주선)는
 * 재생했을 때만 옮겨간다 — 엔진 `FollowState` 주석이 적어 둔 SOCIAL-07 의 두 단계와 같은 구분이다.
 */
export default function MapView({ occlusion }: MapViewProps) {
  const engine = useMemo(() => new MapEngine(), []);
  const narrow = useIsNarrow();
  const features = useFeatures();
  const { ref, size } = useViewport();
  const [hover, setHover] = useState(false);
  /** 호버 카드에 띄울 곡. 카드가 DOM 이라 곡 자체를 들고 있어야 한다 */
  const [hoverSong, setHoverSong] = useState<MapPoint | null>(null);
  /** 카드가 켜져 있나. 꺼져도 사라지는 동안에는 `hoverSong` 이 남아 있는다 */
  const [cardOn, setCardOn] = useState(false);
  /**
   * `hoverSong` 의 거울. 클릭 핸들러가 **지금** 카드에 걸린 곡을 읽으려고 든다 — state 로 읽으면
   * 클로저가 갱신될 때까지 한 박자 늦고, 그 사이 클릭이 빈손으로 끝난다 (S15P21A405-280)
   */
  const heldSong = useRef<MapPoint | null>(null);
  /** 호버 카드의 DOM. 마우스가 그 위인지 매번 다시 재려고 들고 있는다 */
  const hideTimer = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelStart = useRef<{ layer: number; zoom: number; mode: string } | null>(null);
  useEffect(() => () => { if (wheelTimer.current) clearTimeout(wheelTimer.current); }, []);

  // 겹마다 그 겹의 상주 집합을 받는다 — boxes(누적 범위)가 곧 요청 조건이자 캐시 키다
  const boxes = useMapStore((s) => s.boxes);
  const { data: rawSongs, isError: songsFailed } = useMapSongsQuery(boxes);
  // 압력이 차는 동안 다음 겹 집합을 미리 받는다. 같은 키로 요청하므로 파고든 순간 캐시에서 바로 나온다 —
  // 전환이 끝난 뒤 도착하면 임시 집합 → 실제 집합 교체가 한 번 더 보인다 (S15P21A405-284)
  const prefetchBoxes = useMapStore((s) => s.prefetchBoxes);
  const { data: rawPrefetchedSongs } = useMapSongsQuery(prefetchBoxes ?? boxes);

  /**
   * **못 트는 곡은 지도에 올리지 않는다** (S15P21A405-544).
   *
   * 예전에는 흐리게 그리고 호버 카드에 "재생 불가" 를 적었다 (SONG-04). 그런데 누를 수는 있어서,
   * 눌러도 아무 일이 없는 별을 계속 다시 만나게 됐다. 안 보이면 다시 만날 일이 없다.
   *
   * **여기서는 서버가 준 `playable` 만 본다.** 곡을 열어 보고 알게 된 것은 아래 따로 뺀다 —
   * 이 목록을 바꾸면 `setLayerSongs` 를 다시 타는데, 그건 "새 겹의 상주 집합이 도착했다" 는
   * 뜻이라 **겹 전환 연출이 통째로 다시 돈다.** 곡 하나 빠졌다고 지도가 모프하면 안 된다.
   */
  const songs = useMemo(() => rawSongs?.filter((song) => song.playable !== false), [rawSongs]);
  const prefetchedSongs = useMemo(() => rawPrefetchedSongs?.filter((song) => song.playable !== false), [rawPrefetchedSongs]);

  /**
   * 열어 보고 못 튼다고 판명된 곡을 **그 자리에서** 뺀다 (S15P21A405-544).
   *
   * 마스크 한 칸만 끄는 길이라 연출이 없다. `songs` 를 의존성에 둔 이유는 **겹을 옮기면
   * 상주 집합이 새로 깔리기 때문**이다 — 그때 이미 빼 둔 곡이 되살아나므로 다시 빼야 한다.
   */
  const unplayableIds = useUnplayableStore((s) => s.ids);
  useEffect(() => {
    for (const musicId of unplayableIds) engine.hideSong(musicId);
  }, [engine, unplayableIds, songs]);
  // 받은 집합을 엔진에 넘긴다 — 엔진은 이게 있어야 파고들기를 출발한다 (없으면 잠깐 기다린다)
  useEffect(() => {
    if (prefetchBoxes && prefetchedSongs) engine.setPrefetched(prefetchBoxes, prefetchedSongs);
  }, [engine, prefetchBoxes, prefetchedSongs]);
  const layer = useMapStore((s) => s.layer);
  /**
   * 지도 위 사람 — 15초 폴링을 소켓 구독으로 갈아탔다 (S15P21A405-482).
   * 엔진에 넣는 것도 훅이 한다(`setFriends`·`setCrowd`)므로 여기서는 켜기만 한다.
   */
  useViewportSubscription(features.social);
  /**
   * 데모 봇을 굴리는 유일한 시계 (S15P21A405-536). 지도 화면에만 둔다 — 두 군데서 돌면
   * 같은 봇이 화면마다 다른 곡을 듣게 된다.
   */
  useBots(features.social);
  /**
   * 재생 선언을 보내는 유일한 자리 (S15P21A405-569). 지도 화면에만 둔다 —
   * 두 군데서 걸면 곡마다 두 번 선언한다.
   */
  useDeclarePlay();
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const constellationMusicIds = useMapStore((s) => s.constellationMusicIds);
  const constellationPoints = useMapStore((s) => s.constellationPoints);
  const { data: layout } = useConstellationLayoutQuery(constellationMusicIds);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const myMusicId = useMapStore((s) => s.myMusicId);
  const home = useMapStore((s) => s.home);
  const selectMusic = useMapStore((s) => s.selectMusic);
  const syncFromEngine = useMapStore((s) => s.syncFromEngine);
  // 지도에서 별을 누르는 길만 이걸 쓴다 — 주변 사람을 보는 중이면 패널을 갈아타지 않는다 (S15P21A405-515)
  const openSongFromMap = usePanelStore((s) => s.openSongFromMap);
  const openFeed = usePanelStore((s) => s.openFeed);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const playWithConfirm = usePlaySong();
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const leaderNickname = useFollowStore((s) => s.leaderNickname);
  const leaderImageUrl = useFollowStore((s) => s.leaderImageUrl);
  const leaderMusicId = useFollowStore((s) => s.leaderMusicId);
  const leaderViewingMusicId = useFollowStore((s) => s.leaderViewingMusicId);
  // 인솔자 곡 좌표가 뒤늦게 편입되면 다시 건다 — 첫 시도는 `startFollow` 가 `index.has` 에서 빠져나갔다 (S15P21A405-674)
  const leaderPointRevision = useFollowStore((s) => s.pointRevision);
  /**
   * 나를 따라오는 인원 (S15P21A405-557). 1 이상이면 내 표식이 우주선이 되고 뒤에 줄이 선다.
   * 엔진은 스토어를 모르므로 여기서 넣어 준다.
   */
  const followerCount = useFollowStore((s) => s.followerCount);
  const riders = useFollowStore((s) => s.riders);
  useEffect(() => {
    // 얼굴을 아는 사람은 얼굴로, 수만 아는 만큼은 빈 헬멧으로 (S15P21A405-676)
    engine.setMyRiders(
      followerCount,
      riders.map((r) => ({
        email: r.email,
        nickname: r.nickname,
        imageUrl: r.imageUrl,
        isOnline: true,
        musicId: 0,
        viewingMusicId: 0,
        genreId: NO_GENRE_ID,
        meetingCount: 0,
        riderCount: 0,
        followingNickname: null,
        avatarSeed: seedOf(r.email),
      })),
    );
  }, [engine, followerCount, riders]);
  // 내 얼굴 — 내 우주선 창과 매달린 "나" 헬멧에 (S15P21A405-676)
  const { data: me } = useMeQuery();
  useEffect(() => {
    engine.setMyProfile(me ? { nickname: me.nickname, imageUrl: me.imageUrl } : null);
  }, [engine, me]);
  const pickTarget = useJourneyStore((s) => s.pickTarget);
  const { data: nearby } = useNearbyQuery(viewMode === "nearby" ? nearbyCenterMusicId : null);
  /**
   * 주변 탐색을 켜면 **그 곡 상세도 같이 연다** (S15P21A405-348).
   *
   * 주변 탐색 고리는 그 곡 상세에 딸린 화면인데, 켜는 길이 넷(하단 버튼·상세 목록·길게 누르기·
   * 건너가기 링크)이라 어디서 켜느냐에 따라 엉뚱한 패널이 열린 채로 남았다 — 여정 패널을
   * 띄워 둔 채 하단 버튼을 누르면 여정 화면 위에 고리가 겹쳤다. 패널 쪽 짝은
   * `use-panel-store` 의 `syncMapView` 다.
   */
  useEffect(() => {
    if (nearbyCenterMusicId == null) return;
    // 폰에서는 열지 않는다 (S15P21A405-417) — 주변 탐색은 **고리가 결과**인데 패널이 그걸 덮는다
    if (window.innerWidth < BREAKPOINTS.tablet) return;
    // 켠 쪽이 패널을 이미 정했으면 비켜난다 (S15P21A405-384) — 이웃 카드를 고르면 중심은
    // 이 곡이지만 상세는 **고른 이웃**이라, 여기서 중심곡을 열면 그걸 덮어쓴다
    if (useMapStore.getState().nearbyPanelHandled) return;
    const p = usePanelStore.getState();
    // 이미 그 곡 상세가 떠 있으면 건드리지 않는다 — 다시 열면 돌아갈 자리(`back`)가 날아간다
    if (p.activePanel === "song" && p.musicId === nearbyCenterMusicId) return;
    p.openSong(nearbyCenterMusicId);
  }, [nearbyCenterMusicId]);
  /**
   * 겹이 바뀌면 패널을 접는다 (S15P21A405-404). 파고들기·떠오르기·레이어 스테퍼가 모두
   * 이 값을 거치므로 들어오는 길마다 따로 박지 않아도 된다.
   *
   * 붙자마자는 접지 않는다 — 처음 그리는 것은 "겹을 옮겼다" 가 아니다.
   */
  const lastLayer = useRef(layer);
  useEffect(() => {
    if (lastLayer.current === layer) return;
    lastLayer.current = layer;
    usePanelStore.getState().collapse();
  }, [layer]);

  /**
   * 목 반응은 걷어냈다 (S15P21A405-482). 실시간 명세가 **반응을 "아직 없는 것"** 으로 명시했고
   * (따라가기·반응), 소켓에도 반응 메시지가 없다. 목이 계속 돌면 아직 없는 기능이
   * 도는 것처럼 보여서 테스트가 어긋난다. 훅 자체는 남겨 뒀다 — 데이터가 생기면 되살린다.
   */

  // 엔진 등록 + 스냅샷 → 스토어
  useEffect(() => {
    registerMapEngine(engine);
    engine.setSnapshotListener(syncFromEngine);
    // 개발 편의: 콘솔에서 엔진 상태를 들여다볼 수 있게 (프로덕션 제외)
    if (process.env.NODE_ENV !== "production") (window as unknown as { __odyEngine?: MapEngine }).__odyEngine = engine;
    engine.setCallbacks({
      onFollowEnd: () => useFollowStore.getState().stop(),
      onArrive: (id) => usePlayerStore.getState().playSingle(id),
      // 인솔자가 보고 있는 곡의 상세를 우측 패널에도 띄운다 (SOCIAL-07)
      onLeaderViewingChange: (id) => {
        useMapStore.getState().selectMusic(id);
        usePanelStore.getState().openSong(id);
      },
    });
    return () => registerMapEngine(null);
  }, [engine, syncFromEngine]);

  useEffect(() => engine.setOcclusion(occlusion), [engine, occlusion]);

  /**
   * 지도 위에 떠 있는 HUD 상자를 재서 엔진에 넘긴다 — 화면 밖 표식이 여기에 가리지 않게 한다.
   * 상수로 박으면 패널이 열리고 닫힐 때마다 틀어지므로 **실제 DOM 을 잰다.**
   * 패널 전환은 애니메이션이 있어서 조금 뒤에 한 번 더 잰다.
   */
  useEffect(() => {
    const measure = () => {
      const host = document.querySelector("canvas")?.getBoundingClientRect();
      if (!host) return;
      /**
       * 좁은 화면에는 좌하단 계기판이 없다 (S15P21A405-417) — 별자리가 그 자리를 피할 이유도
       * 없다. 안 알려 주면 375px 에서 별자리를 놓을 폭이 70px 로 줄어 점처럼 뭉친다.
       * 여기서 폭을 읽어도 되는 이유는 이 effect 가 **이미 DOM 을 재고 있는** 자리이기 때문이다.
       */
      engine.setInstrumentInset(window.innerWidth < BREAKPOINTS.tablet ? 0 : CONSTELLATION.instrumentInsetPx);
      engine.setObstacles(
        [...document.querySelectorAll("[data-hud]")].map((el) => {
          const r = el.getBoundingClientRect();
          return { x0: r.left - host.left, y0: r.top - host.top, x1: r.right - host.left, y1: r.bottom - host.top };
        }),
      );
    };
    measure();
    const later = setTimeout(measure, 420);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(later);
      window.removeEventListener("resize", measure);
    };
  }, [engine, occlusion, viewMode]);

  // 이 겹의 상주 집합이 도착하면 엔진에 넣는다. 첫 진입이면 저장된 내 곡 자리에서 시작
  useEffect(() => {
    if (!songs) return;
    if (!engine.ready) {
      engine.setInitialMy(readStorage<number>(STORAGE_KEYS.myMusicId));
      // 돌아갈 자리까지 되살려야 새로고침 뒤에도 "내 위치로 가기" 가 먹는다 (S15P21A405-275)
      engine.restoreHome(readStorage<{ musicId: number; boxes: LayerBox[] }>(STORAGE_KEYS.myHome));
    }
    engine.setLayerSongs(boxes.length, songs);
    trackOnce("map-ready", "map_ready", { result_count: songs.length, layer: boxes.length });
  }, [engine, boxes, songs]);
  /**
   * 커버로 띄울 후보곡 — **이미 받은 상주 집합에서 뽑는다** (S15P21A405-513).
   *
   * 예전에는 `/bff/map/layers/{l}/representatives` 를 따로 불렀는데, 그 라우트가 하는 일이
   * `/api/music/major` 를 **통째로 다시 받아** 재생수 상위 40개의 id 만 남기고 버리는 것이었다.
   * 같은 응답을 `songs` 가 이미 들고 있으니 두 번 받을 이유가 없다 — 실측으로 겹 하나 여는 데
   * 1.5초짜리 요청이 하나 더 붙었고, 둘이 겹쳐 돌면서 서로를 느리게 만들었다.
   *
   * 덤으로 레이어 2 부터 나던 400 도 사라진다 — 그 라우트가 누적 범위를 안 보내서 백엔드
   * `MajorQuery` 의 `accumulated.size() == level-1` 검사에 걸리고 있었다.
   */
  const repPoints = useMemo(
    () => (songs ? [...songs].sort(byCoverPriority((p) => p.albumMbid != null, (p) => p.weight)).slice(0, REPRESENTATIVE_COUNT) : null),
    [songs],
  );
  const representatives = useMemo(() => repPoints?.map((p) => p.musicId) ?? null, [repPoints]);
  /**
   * **커버를 미리 받아 둔다** (S15P21A405-528). 한 장에 2.4~3.4초가 걸리는데(리다이렉트 두 번 +
   * archive.org 응답), 예전에는 그리려고 볼 때 비로소 받기 시작해서 지도가 자리잡은 뒤에 또
   * 그만큼 기다렸다. 후보가 정해지는 순간 시작해 두면 그릴 때는 이미 와 있다.
   *
   * 앞쪽만 데운다 — 화면에 동시에 뜨는 커버는 스무 개 남짓이고, 마흔 장을 한꺼번에 부르면
   * 같은 호스트에 줄이 서서 앞엣것까지 늦어진다.
   */
  useEffect(() => {
    if (!repPoints) return;
    for (const p of repPoints.slice(0, COVER_COUNT.near)) albumCover(p.musicId, p.albumMbid, COVER_PX);
  }, [repPoints]);
  useEffect(() => {
    // 겹 번호는 songs 를 넣을 때와 **같은 값**을 쓴다 — 둘이 어긋나면 엔진이 남의 겹 커버를 든다
    if (representatives) engine.setRepresentatives(boxes.length, representatives);
  }, [engine, boxes.length, representatives]);

  // 주변 탐색: 유사곡 10곡이 오면 연출 뷰로 진입, 모드가 꺼지면 복귀
  useEffect(() => {
    if (viewMode === "nearby" && nearby) {
      engine.enterProbe(nearby.center, nearby.neighbors);
      nearbyResults(nearby.center.musicId, nearby.neighbors.length);
    }
    else if (viewMode !== "nearby") engine.exitProbe();
  }, [engine, viewMode, nearby]);
  // 별자리 오버레이 뷰: 배치가 도착하면 대형으로 모이고, 뷰를 닫으면 제자리로 흩어진다 (PATH-01)
  useEffect(() => {
    if (viewMode === "constellation" && layout) {
      // 경로 곡은 이 겹 상주 집합 밖일 수 있다 — 먼저 편입해야 별자리에 다 그려진다
      engine.adopt(constellationPoints);
      engine.enterConstellation(constellationMusicIds, layout.points);
    } else if (viewMode !== "constellation") engine.exitConstellation();
  }, [engine, viewMode, constellationMusicIds, constellationPoints, layout]);
  useEffect(() => engine.setSelected(selectedMusicId), [engine, selectedMusicId]);

  /**
   * 새로고침으로 되살린 곡 — 플레이어바에만 얹고 **지도는 건드리지 않는다** (S15P21A405-275).
   * `travelTo` 를 태우면 내 자리를 지금 겹 기준으로 다시 잡아서, 되살린 `home` 의 겹 정보가 날아간다.
   */
  const restoredPlaying = useRef<number | null>(null);
  const restoreLastPlayed = usePlayerStore((s) => s.restoreLast);
  useEffect(() => {
    const saved = readStorage<number>(STORAGE_KEYS.playingMusicId);
    if (saved == null) return;
    restoredPlaying.current = saved;
    restoreLastPlayed(saved);
  }, [restoreLastPlayed]);

  /**
   * 재생 → 내 위치가 그 곡으로 이동 (MAP-08), 그리고 **선택도 함께 옮긴다** (S15P21A405-578).
   *
   * 선택을 같이 옮기는 이유는 [`shouldFollowPlayback`](./selection-follow.ts) 에 적었다 —
   * 요약하면 재생이 저 혼자 넘어갈 때 선택이 낡은 별에 남아 주변 탐색이 엉뚱한 곡을 펼쳤다.
   *
   * **선택은 `getState()` 로 읽는다.** 의존성에 넣으면 여기서 선택을 바꾼 것이 다시 이 효과를
   * 깨워 제 꼬리를 문다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    // 되살린 값은 "지금 막 재생한 것" 이 아니다 — 한 번만 흘려보낸다
    const restored = currentMusicId === restoredPlaying.current;
    if (restored) restoredPlaying.current = null;
    else engine.travelTo(currentMusicId);

    const follow = shouldFollowPlayback({
      playingMusicId: currentMusicId,
      selectedMusicId: useMapStore.getState().selectedMusicId,
      restored,
      riding: isRiding(),
    });
    if (follow) selectMusic(currentMusicId);
  }, [engine, currentMusicId, selectMusic]);

  /**
   * 따라가기 (SOCIAL-06 ~ 09, S15P21A405-530).
   *
   * **인솔자 표식은 서버 목록에 없다.** 옮겨 받는 화면(`RIDE_VIEWPORT*`)은 인솔자 기준으로
   * 만들어져 인솔자 자신이 빠져 있다 (2차 명세 §4.2). 그래서 `engine.friends` 에서 찾지 않고
   * 탑승 응답이 준 값으로 **직접 만들어** 넘긴다.
   *
   * `driven: true` 로 켠다 — 엔진 안의 목(인솔자가 스스로 다음 곡을 고르는 시늉)을 멈추고,
   * 곡 이동은 `RIDE_TRACK` 이 올 때만 일어나게 한다. 엔진의 `follow` 는 그대로 두는데,
   * 팬·줌·레이어 이동·내 위치로 가기를 막는 잠금이 거기 달려 있기 때문이다 (§6).
   *
   * `leaderMusicId` 를 의존성에 둔 이유는 **겹이 바뀌면 다시 걸어야** 하기 때문이다 —
   * `startFollow` 는 그 곡이 지금 겹의 상주 집합에 있을 때만 켜진다.
   */
  useEffect(() => {
    if (!leaderEmail || leaderMusicId == null) {
      engine.stopFollow();
      return;
    }
    engine.startFollow(
      {
        email: leaderEmail,
        nickname: leaderNickname,
        imageUrl: leaderImageUrl,
        // 목록에 있다는 것이 곧 접속 중이라는 뜻이다 (명세 §5.6)
        isOnline: true,
        musicId: leaderMusicId,
        // 인솔자가 옆 곡을 눌러 보는 동안은 서 있는 곡과 다르다 (§551)
        viewingMusicId: leaderViewingMusicId ?? leaderMusicId,
        genreId: engine.genreOf(leaderMusicId) ?? NO_GENRE_ID,
        meetingCount: 0,
        // 인솔자 본인의 동승 인원은 우리에게 오지 않는다 (2차 명세 §14). 0 으로 둔다
        riderCount: 0,
        followingNickname: null,
        avatarSeed: seedOf(leaderEmail),
      },
      true,
    );
  }, [engine, leaderEmail, leaderNickname, leaderImageUrl, leaderMusicId, leaderViewingMusicId, leaderPointRevision, layer]);

  // 내 곡·돌아갈 자리 영구 저장 — 새로고침해도 '나' 와 "내 위치로 가기" 가 살아 있게 (S15P21A405-275)
  useEffect(() => {
    if (myMusicId != null) writeStorage(STORAGE_KEYS.myMusicId, myMusicId);
  }, [myMusicId]);
  useEffect(() => {
    if (home) writeStorage(STORAGE_KEYS.myHome, home);
  }, [home]);

  /**
   * 별에서 벗어나도 **곧바로 끄지 않는다.** 별과 카드 사이에는 틈이 있어서 카드로 가는 동안에는
   * 아무것도 안 잡히는데, 그 순간 꺼 버리면 카드에 닿기 전에 사라진다 (실제로 그랬다).
   */
  const cancelHide = useCallback(() => {
    if (hideTimer.current == null) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const scheduleHide = useCallback(() => {
    if (hideTimer.current != null) return;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setCardOn(false);
    }, HOVER_CARD.graceMs);
  }, []);
  /**
   * 다 사라진 뒤에야 떼어 낸다. 엔진의 호버도 여기서 푼다 —
   * 먼저 풀면 카드가 자기 자리를 잃어서 사라지는 대신 **툭 없어진다.**
   */
  useEffect(() => {
    if (cardOn || hoverSong == null) return;
    const t = setTimeout(() => {
      engine.setHover(null);
      heldSong.current = null;
      setHoverSong(null);
    }, HOVER_CARD.fadeMs);
    return () => clearTimeout(t);
  }, [engine, cardOn, hoverSong]);
  useEffect(() => cancelHide, [cancelHide]);

  /**
   * 따라가는 동안 막힌 지도 입력(휠·드래그)의 안내 (S15P21A405-605). 조용히 씹지 않는다 —
   * 눌렀는데 아무 일도 안 나는 것이 제일 나쁘다. 연속 입력이라 한 번 뜬 뒤 잠깐 쉰다.
   */
  const lockToastAt = useRef(0);
  const notifyMapLocked = useCallback(() => {
    const now = Date.now();
    if (now - lockToastAt.current < RIDE_LOCK_TOAST_MS) return;
    lockToastAt.current = now;
    useToastStore.getState().show(RIDING_MAP_LOCKED);
  }, []);
  /**
   * 확대·축소 한 번. **휠과 두 손가락이 같은 길로 들어온다** (S15P21A405-415).
   *
   * 나누지 않는 이유는 이 함수가 하는 일이 확대만이 아니기 때문이다 — 뷰 모드별 분기(별자리는
   * 오버레이만, 주변 탐색은 줌아웃이 곧 해제), 분석 이벤트, 그리고 엔진 쪽 파고들기 게이트·압력이
   * 전부 여기 걸려 있다. 손가락용 확대를 따로 만들면 **핀치로는 파고들 수 없는** 지도가 된다.
   */
  const zoomBy = useCallback(
    (deltaY: number, mx: number, my: number) => {
      // 따라가는 중에는 확대·축소도 없다 (S15P21A405-605, SOCIAL-08) — 엔진도 막지만 이유는 여기서 말한다
      if (isRiding()) {
        notifyMapLocked();
        return;
      }
      const mode = useMapStore.getState().viewMode;
      const mapSnapshot = useMapStore.getState();
      wheelStart.current ??= { layer: mapSnapshot.layer, zoom: mapSnapshot.zoomK, mode };
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      const eventContext = analyticsContext();
      wheelTimer.current = setTimeout(() => {
        const start = wheelStart.current;
        wheelStart.current = null;
        if (!start) return;
        const end = useMapStore.getState();
        track("map_zoom_completed", { ...eventContext, view_mode: start.mode, from_layer: start.layer, layer: end.layer, from_zoom: start.zoom, zoom: end.zoomK });
      }, ANALYTICS.wheelSettleMs);
      // 오버레이가 떠 있으면 뒷화면 지도는 건드리지 않는다 — 휠은 오버레이 안에서만 작동
      if (mode === "constellation") {
        engine.overlayWheel(deltaY);
        return;
      }
      /**
       * 주변 탐색 — **확대는 화면을 키우고, 끝까지 줄이면 뷰를 나간다** (S15P21A405-593).
       *
       * 예전에는 확대가 아무 일도 안 했다. 이 뷰는 카메라가 아니라 화면 크기에서 반지름을
       * 뽑아 세운 배치라 확대할 카메라가 없었기 때문이다. 고리 반지름만 키워 봤더니 중심 별도
       * 제목도 배경도 그대로인 채 **살만 길어져서** "확대가 아니라 줄이 늘어난 것" 이 됐다 —
       * 지금은 캔버스를 통째로 키운다 (`probeView`, `draw-map`).
       *
       * 축소는 그대로 **나가기**다 — 키운 것을 되돌리는 뜻으로만 쓰면 이 뷰를 빠져나가는
       * 길이 사라진다. 휠 한 칸의 비율을 그대로 배율로 쓴다.
       */
      if (mode === "nearby") {
        /**
         * **줄이는 입력은 먼저 배율을 깎는다.** 바닥(`PROBE.minZoom`)에 닿았을 때만 나간다 —
         * 핀치는 벌리는 중에도 안쪽으로 몇 px 흔들리는데, 예전에는 그 한 번이 곧바로
         * 나가기였다. 확대해 놓고도 화면이 원래대로 돌아가서 "확대가 안 된다" 로 보였다.
         */
        if (engine.probeZoom(Math.exp(-deltaY * WHEEL_ZOOM)) <= PROBE.minZoom) useMapStore.getState().exitNearby();
        return;
      }
      // 확대 단계를 넘기는 판정은 여기서 하지 않는다 (S15P21A405-351) — 휠 한 칸으로 끝나 버린다.
      // 배율이 얼마나 올랐는지는 튜토리얼이 직접 본다 (`tutorial-overlay.tsx`)
      return engine.wheel(deltaY, mx, my);
    },
    [engine, notifyMapLocked],
  );

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      // 확대는 "다른 동작" 이다 — 펼쳐 둔 사람 묶음을 접는다 (S15P21A405-618)
      engine.collapseStack();
      zoomBy(e.deltaY, e.clientX - r.left, e.clientY - r.top);
    },
    [zoomBy, engine],
  );
  /**
   * 길게 누르기 = 그 별 주변으로 **파고들기** (S15P21A405-288). 휠 압력으로 다음 겹에 파고드는 것과 같은 은유다.
   * 누르는 동안 별 둘레로 링이 차오르고(drawHold), 다 차면 그 별이 주변 탐색의 중심이 된다.
   * 움직이면(드래그) 취소, 놓으면 취소 — 다 찬 뒤의 mouseup 은 클릭으로 치지 않는다 (재생돼 버리면 안 된다)
   */
  const holdTimer = useRef<number | null>(null);
  const holdFired = useRef(false);
  const cancelHold = useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    engine.cancelHold();
  }, [engine]);
  useEffect(() => cancelHold, [cancelHold]);

  /**
   * 지금 화면에 닿아 있는 포인터들 (id → 마지막 화면 좌표). **둘이 되면 핀치다.**
   *
   * 마우스도 포인터 이벤트를 내므로 데스크톱은 늘 하나다 — 기존 드래그·누르기 코드가 그대로
   * 돈다. 손가락 둘이 닿는 순간에만 다른 길로 빠진다.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** 직전 두 손가락 사이 거리(px). `null` 이면 핀치 중이 아니다 */
  const pinchDist = useRef<number | null>(null);
  /**
   * 직전 확대가 **압력 구간**이었나 (게이트가 열려 배율이 얼어 있는 상태).
   *
   * 그 구간에서는 손가락 이동을 {@link PINCH.pressureBoost} 만큼 부풀려 보낸다 — 핀치는 화면 폭이
   * 한계라 휠만큼 누적을 못 만든다. 배율이 얼어 있는 동안이라 부풀려도 손가락과 어긋나 보이지 않는다.
   */
  const pinchPressing = useRef(false);
  /** 닿아 있는 둘의 거리와 가운데. 셋 이상이면 먼저 닿은 둘만 본다 */
  const pinchNow = useCallback(() => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      /*
       * 손가락이 이 요소 밖으로 나가도 계속 받는다. 안 잡아 두면 지도를 끌다가 패널이나 화면
       * 밖으로 넘어가는 순간 이동이 끊기고, 그 자리에서 손을 떼면 up 이 아예 안 온다.
       *
       * **반드시 감싼다.** 그 사이 포인터가 이미 풀렸으면 `NotFoundError` 를 던지는데, 여기서
       * 터지면 아래 핀치 준비와 드래그 시작이 통째로 안 돈다 — 잡기에 실패했다고 조작까지
       * 못 하게 둘 이유가 없다.
       */
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 이미 풀린 포인터 — 잡기만 포기하고 계속 간다 */
      }
      if (pointers.current.size >= 2) {
        // 둘째 손가락이 닿는 순간 한 손가락 동작은 접는다 — 벌리는 중에 별이 선택되면 안 된다
        cancelHold();
        drag.current = null;
        pinchDist.current = pinchNow()?.dist ?? null;
        pinchPressing.current = false;
        return;
      }
      drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
      holdFired.current = false;
      if (engine.follow) return;
      const map = useMapStore.getState();
      // 기본 뷰와 주변 뷰에서만. 별자리 뷰나 여정 지정 중에는 누르기가 다른 뜻이 된다
      if (map.viewMode === "constellation" || useJourneyStore.getState().pickTarget) return;
      const r = e.currentTarget.getBoundingClientRect();
      const hit = engine.hitTest(e.clientX - r.left, e.clientY - r.top);
      if (!hit) return;
      const id = engine.songs[hit.i].musicId;
      // 지금 중심을 눌러도 갈 데가 없다
      if (map.viewMode === "nearby" && id === map.nearbyCenterMusicId) return;
      engine.startHold(id);
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        engine.cancelHold();
        holdFired.current = true;
        drag.current = null;
        useMapStore.getState().enterNearby(id);
        useTutorialStore.getState().complete("nearby");
      }, HOLD.ms);
    },
    [engine, cancelHold, pinchNow],
  );
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      /*
       * 두 손가락 = 확대. 거리의 **비율**을 휠 델타로 바꿔 `zoomBy` 로 보낸다 — 파고들기 게이트와
       * 압력이 그 안에 있어서, 여기서 배율을 직접 만지면 핀치로는 겹을 넘을 수 없게 된다.
       */
      if (pointers.current.size >= 2) {
        const p = pinchNow();
        if (!p || pinchDist.current == null) return;
        if (Math.abs(p.dist - pinchDist.current) < PINCH.minDeltaPx) return;
        // 손가락 하나가 잠깐 빠졌다 돌아오면 거리가 몇 배씩 튄다 — 한 번에 받는 폭을 묶는다
        const k = Math.min(PINCH.maxStep, Math.max(1 / PINCH.maxStep, p.dist / pinchDist.current));
        pinchDist.current = p.dist;
        const boost = pinchPressing.current ? PINCH.pressureBoost : 1;
        const verdict = zoomBy((-Math.log(k) / WHEEL_ZOOM) * boost, p.mx - r.left, p.my - r.top);
        pinchPressing.current = verdict === "pressure";
        return;
      }
      if (drag.current) {
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        // 지도를 끌기 시작하면 펼쳐 둔 사람 묶음을 접는다 (S15P21A405-618)
        if (drag.current.moved > 5) engine.collapseStack();
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        // 움직였으면 누르기가 아니라 드래그다
        if (drag.current.moved > HOLD.moveTol) {
          cancelHold();
          /**
           * 지도를 움직인다는 것은 **지금 지도를 보고 있다**는 뜻이다 (S15P21A405-404).
           * 열린 패널이 지도를 376px 가리고 있으므로 자리를 비켜 준다. 누르기와 드래그를
           * 가르는 이 기준을 그대로 쓰는 이유는, 별을 누르려다 손이 떨린 정도로 접히면
           * 안 되기 때문이다. 닫지는 않는다 — 별자리도 목록도 그대로 살아 있다.
           */
          usePanelStore.getState().collapse();
        }
        const mode = useMapStore.getState().viewMode;
        // 오버레이 안에서는 별자리만 움직인다 (뒷화면 지도는 그대로)
        if (isRiding()) notifyMapLocked();
        else if (mode === "constellation") engine.overlayPan(dx, dy);
        // 주변 탐색 중에는 지도 대신 탐색 별 뷰를 민다 (S15P21A405-285)
        else if (mode === "nearby") engine.probePan(dx, dy);
        else engine.dragBy(dx, dy);
        return;
      }
      // 손가락에는 호버가 없다 (S15P21A405-415). 여기부터는 마우스만 — 탭의 대체 동작은 누르기가 맡는다
      if (e.pointerType !== "mouse") return;
      // 호버 카드는 이벤트를 받지 않는다 (S15P21A405-323). 카드 위인지 재던 판정이 여기 있었는데,
      // 이제 마우스는 언제나 지도에 닿으므로 카드 뒤의 별도 그냥 집힌다 — 툴팁이 그 곡으로 바뀐다
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const hitF = engine.hitFriend(mx, my);
      const hit = hitF ? null : engine.hitTest(mx, my);
      const song = hit ? engine.songs[hit.i] : null;
      // 주변 탐색 중에는 호버 카드를 띄우지 않는다 (S15P21A405-288) — 고리 별에는 제목·순위 라벨이 이미 붙어 있고,
      // 카드가 뜨면 이웃 라벨과 "주변 보기 ›" 링크를 가린다. 별 위 강조 링과 커서만 남긴다
      const inNearby = useMapStore.getState().viewMode === "nearby";
      if (song && !inNearby) {
        cancelHide();
        engine.setHover(song.musicId);
        heldSong.current = song;
        setHoverSong(song);
        setCardOn(true);
      } else {
        if (inNearby) engine.setHover(song?.musicId ?? null);
        scheduleHide();
      }
      setHover(!!hit || !!hitF || !!engine.hitHopLink(mx, my));
    },
    [engine, cancelHide, scheduleHide, cancelHold, pinchNow, zoomBy, notifyMapLocked],
  );
  /**
   * 곡을 **재생**한다 — 상세를 열면서 동시에. 호버 카드의 재생 버튼과 선택된 별 재클릭이 여기로 온다.
   * 내 위치는 `currentMusicId` 가 바뀌는 것을 보고 위쪽 이펙트가 옮긴다 (재생 = 이동, 한 자리에서만).
   * 주변 탐색 중이면 엔진이 우주선만 고리 안 그 별로 옮기고 고리·카메라는 그대로 둔다 — 정찰 (S15P21A405-288)
   */
  const playSong = useCallback(
    (s: MapPoint) => {
      // 별이 이미 들고 있는 제목·아티스트다 — 재생바가 상세 조회를 기다리지 않게 넘긴다 (S15P21A405-585)
      rememberMusicHints([{ id: s.musicId, title: s.title, artist: s.artist }]);
      selectMusic(s.musicId);
      // 폰에서는 재생해도 패널을 열지 않는다 — 지금 듣는 곡은 재생바가 이미 보여 준다
      if (!narrow) openSongFromMap(s.musicId);
      // 순차 재생 중 목록 밖의 곡이면 먼저 물어본다 (S15P21A405-341)
      // 선언은 `use-declare-play` 한 곳이 한다 (S15P21A405-569) — 여기서 또 부르면 두 번 나간다
      playWithConfirm(s.musicId);
      useTutorialStore.getState().complete("select");
    },
    [narrow, openSongFromMap, playWithConfirm, selectMusic],
  );

  /**
   * 별을 **누른다** — 첫 클릭은 선택(상세만), **이미 선택된 별을 다시 누르면 재생** (S15P21A405-288).
   * 기본 뷰와 주변 탐색 뷰의 문법이 같다. 예전에는 주변 뷰에서 이웃을 누르는 순간 건너갔는데(S15P21A405-285),
   * 그러면 한 곡에 서서 이웃들을 차례로 들어볼 수가 없었다. 건너가기(항해)는 하단 주변 탐색 버튼이 맡는다.
   * 주변 뷰에서는 카메라를 옮기지 않는다 — 고리가 뷰다 (이웃의 실제 자리는 고리 밖 엉뚱한 곳일 수 있다)
   */
  const pressSong = useCallback(
    (s: MapPoint) => {
      /**
       * **따라가는 동안에는 별을 고를 수 없다** (S15P21A405-567).
       *
       * 재생은 `use-play-song` 이 이미 막지만 **선택과 상세 열기는 그대로 돌았다.** 따라가는
       * 동안 우측은 인솔자가 열어 둔 곡이어야 하는데(S15P21A405-557) 그걸 덮어 버리고,
       * 내가 다시 돌려놓을 방법도 없다 — 인솔자가 다음 곡을 누를 때까지 엉뚱한 상세를 본다.
       *
       * 조용히 씹지 않는다. 눌렀는데 아무 일도 안 나는 것이 제일 나쁘다.
       */
      if (isRiding()) {
        useToastStore.getState().show(RIDING_LOCKED);
        return;
      }
      const map = useMapStore.getState();
      track("music_clicked", { music_id: s.musicId, source: "canvas", action: map.selectedMusicId === s.musicId ? "play" : "inspect" });
      if (map.selectedMusicId === s.musicId) {
        playSong(s);
        return;
      }
      // 클릭 = **보기만** (S15P21A405-277). 상세를 열고 뷰만 그리로 옮긴다 —
      // 내 위치는 제자리고, 선택 링만 붙는다. 우주선은 재생해야 날아간다
      selectMusic(s.musicId);
      /**
       * **폰에서도 곡 상세를 바로 연다** (S15P21A405-593).
       *
       * 예전에는 호버 카드를 띄우고 그 안의 `상세` 를 눌러야 들어갔다 (S15P21A405-417).
       * 이유는 "375px 에서 패널이 화면만큼 넓어 여는 순간 지도가 사라진다" 였는데, 시트가
       * 3 단으로 서면서 **그 전제가 없어졌다** — 1 단으로 열면 제목 줄만 올라오고 지도는
       * 그대로다. 카드 한 겹과 탭 한 번이 통째로 빠진다.
       *
       * **주변 탐색·여정에서도 같다.** 주변 탐색만 예외였는데 (S15P21A405-288, 카드가 고리
       * 라벨을 덮는다는 이유) 덮을 카드가 없어졌으므로 그 예외도 같이 없앤다.
       */
      openSongFromMap(s.musicId, narrow ? 1 : undefined);
      // 별자리 뷰는 카메라가 아니라 오버레이 변환으로 그린다 — 다가가는 길이 따로다 (S15P21A405-330)
      if (map.viewMode === "constellation") engine.overlayFocus(s.musicId);
      else if (map.viewMode !== "nearby") engine.viewSong(s.musicId);
      useTutorialStore.getState().complete("select");
    },
    [engine, narrow, openSongFromMap, playSong, selectMusic],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const wasPinching = pinchDist.current != null;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchDist.current = null;
      /*
       * 핀치를 끝내며 뗀 손가락은 **탭이 아니다.** 여기서 아래로 흘려보내면 벌렸다 놓을 때마다
       * 손가락 밑에 있던 별이 선택되거나, 이미 선택된 별이면 재생까지 된다.
       *
       * 다만 **손가락이 하나 남아 있으면 그 자리에서 이동을 잇는다** (S15P21A405-415). 안 이으면
       * 벌린 뒤 한 손가락으로 밀 때 아무 일도 안 일어나고, 뗐다 다시 대야 먹는다 — 폰에서
       * "어정쩡하다" 고 나온 그 느낌이다.
       */
      if (wasPinching) {
        cancelHold();
        const [rest] = [...pointers.current.values()];
        drag.current = rest ? { x: rest.x, y: rest.y, moved: 0 } : null;
        return;
      }
      cancelHold();
      const d = drag.current;
      drag.current = null;
      // 길게 눌러서 이미 파고들었으면 이 mouseup 은 클릭이 아니다
      if (holdFired.current) {
        holdFired.current = false;
        return;
      }
      if (!d) return;
      if (d.moved > 5) { track("map_pan_completed", { distance_px: Math.round(d.moved) }); return; }
      const r = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      // 선택한 이웃 라벨 밑 "주변 보기 ›" 링크 — 그 별 주변으로 건너간다 (S15P21A405-288)
      const link = engine.hitHopLink(mx, my);
      if (link) {
        useMapStore.getState().enterNearby(link.id);
        return;
      }
      const fr = engine.hitFriend(mx, my);
      if (fr) {
        /**
         * 겹친 표식(+N)은 **먼저 갈라 보인다** (S15P21A405-618). 같은 노래를 듣는 사람은 좌표가 같아
         * 확대해도 안 풀리므로, 누르는 것이 뒤사람을 보는 유일한 길이다. 갈라진 개별 표식은
         * `stacked` 가 비어 있어 예전처럼 바로 프로필이다.
         */
        if (fr.stacked.length > 0) {
          engine.expandStack(fr.user.email);
          return;
        }
        engine.collapseStack();
        openFeed(fr.user.email);
        return;
      }
      // 사람 아닌 곳을 눌렀다 — 펼쳐 둔 묶음은 접는다
      engine.collapseStack();
      if (engine.follow) return;
      // 고스트별을 누르면 상세만 열고 화면은 그대로 둔다 — 이동은 상세 안 버튼으로 (MAP-12)
      const gid = engine.hitGhost(mx, my);
      if (gid != null) {
        track("music_clicked", { music_id: gid, source: "ghost", action: "inspect" });
        selectMusic(gid);
        openSongFromMap(gid);
        return;
      }
      const hit = engine.hitTest(mx, my);
      /**
       * 별에 정확히 안 있어도 **카드가 떠 있으면 그 곡이다** (S15P21A405-280). 별에서 벗어난 뒤
       * 유예·페이드 동안 카드는 보이는데 클릭이 빈손이면, 사용자는 "보이는 걸 눌렀는데 안 열린다" 로 겪는다.
       *
       * **마우스일 때만이다** (S15P21A405-417). 이 규칙은 커서가 별과 카드 사이 틈을 지나는
       * 동안의 이야기고, 손가락에는 그 틈이 없다. 폰에서는 탭 한 번에 카드가 떠서 다음 탭까지
       * 그대로 남는데, 여기서 같이 흘려보내면 **빈 곳을 눌러도 그 곡이 재생됐다** (실측).
       */
      const song = hit ? engine.songs[hit.i] : e.pointerType === "mouse" ? heldSong.current : null;
      if (!song) {
        // 손가락으로 빈 곳을 누르는 것은 "그만 볼래" 다 — 떠 있던 카드를 내린다.
        // 엔진 호버와 `heldSong` 은 페이드가 끝난 뒤 위쪽 이펙트가 푼다
        if (heldSong.current) setCardOn(false);
        /**
         * **폰에서만 빈 곳을 눌러도 고리를 안 닫는다** (S15P21A405-593).
         *
         * 이 규칙 자체는 S15P21A405-384(`55219af2`)에서 들어왔다 — 곡 상세에서 켜는 버튼이
         * 없어지면서 끄는 길도 같이 사라졌다는 이유였고, 여기는 공용 코드라 **데스크톱에도
         * 그대로 있다.** 마우스로 빈 곳을 누르는 건 한 번에 깔끔히 끝나고 확대도 휠로 하므로
         * 거기서는 이 규칙이 걸리적거리지 않는다.
         *
         * 손가락은 다르다. 핀치는 두 손가락이 한 박자 어긋나게 닿는데, 둘째 손가락이 늦거나
         * 누락되면 그 제스처가 통째로 "빈 곳 탭" 으로 읽혀 뷰가 닫혔다 — 벌리는 손이 곧
         * 나가는 손이 되니 **확대가 되다 말고 원래대로 돌아갔다.** 폰에는 대신 뷰 칩의 ✕ 와
         * 축소로 나가는 길이 있고, 별자리(경로 탐색)도 처음부터 빈 곳으로는 안 닫혔다 —
         * 폰에서는 둘이 같아진다.
         *
         * **데스크톱은 그대로 둔다.**
         */
        if (!narrow) {
          // 분석 이벤트(`nearby_closed`)는 스토어 구독자가 알아서 남긴다 (`analytics/observe`)
          const map = useMapStore.getState();
          if (map.viewMode === "nearby") map.exitNearby();
        }
        return;
      }
      const id = song.musicId;
      // 오버레이가 **떠 있는 동안에만** 그 안의 곡으로 가둔다 (PATH-01-1).
      // 닫힌 뒤에도 가두면 지도의 별이 영영 안 눌린다 — 실제로 그랬다 (S15P21A405-270)
      const overlayIds = engine.clickableOverlayIds();
      if (overlayIds && !overlayIds.has(id)) return;
      // 여정 지정 모드면 클릭이 출발·도착 칸을 번갈아 채운다 (JOURNEY-01)
      const journey = useJourneyStore.getState();
      if (journey.pickTarget) {
        track("music_clicked", { music_id: id, source: "canvas", action: `set_${journey.pickTarget}` });
        // 출발·도착 칸이 곧바로 제목을 띄우게 한다 (S15P21A405-585)
        rememberMusicHints([{ id, title: song.title, artist: song.artist }]);
        journey.pickForNext(id);
        selectMusic(id);
        return;
      }
      pressSong(song);
    },
    [engine, cancelHold, narrow, openFeed, openSongFromMap, pressSong, selectMusic],
  );
  /**
   * **마우스에만 뜻이 있다** (S15P21A405-415). 커서가 지도 밖으로 나가면 드래그도 호버도 끝이다.
   *
   * 손가락에는 적용하지 않는다. 포인터를 잡아 뒀으므로(`setPointerCapture`) 손가락이 요소 밖으로
   * 나가도 이벤트는 계속 오고, 끝나는 것은 `pointerup`·`pointercancel` 이 알려 준다. 그런데
   * 브라우저는 끄는 도중에도 `pointerleave` 를 쏠 수 있고, 그때 여기서 드래그를 지우면
   * **몇 px 가다 멈추고 손을 뗐다 다시 대야** 하는 상태가 된다 — 폰에서 "개미 오줌만큼씩만
   * 움직인다" 고 나온 그 증상이다.
   */
  const onPointerLeave = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    if (drag.current && drag.current.moved > 5) track("map_pan_completed", { distance_px: Math.round(drag.current.moved), reason: "leave" });
    drag.current = null;
    cancelHold();
    scheduleHide();
    setHover(false);
  }, [scheduleHide, cancelHold]);

  /**
   * 브라우저가 제스처를 가져갔다 (S15P21A405-415). **탭이 아니다** — `onPointerUp` 으로 보내면
   * 움직인 거리가 임계 아래일 때 클릭으로 읽혀서, 취소됐는데 별이 선택되거나 재생까지 된다.
   * 여기서는 붙잡고 있던 것만 내려놓는다.
   */
  const onPointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchDist.current = null;
      drag.current = null;
      cancelHold();
    },
    [cancelHold],
  );

  const following = leaderEmail != null;
  // 카드가 떠 있는 동안은 별 밖이라도 클릭이 그 곡을 연다 — 커서도 그렇게 말해야 한다
  const cursor = following ? "cursor-not-allowed" : pickTarget ? "cursor-crosshair" : hover || hoverSong != null ? "cursor-pointer" : "cursor-grab active:cursor-grabbing";

  return (
    <div
      data-analytics-manual
      data-map
      ref={ref}
      /*
       * `touch-none` 은 브라우저의 기본 제스처를 전부 끈다 (S15P21A405-415) — 스크롤·고무줄·
       * 더블탭 확대. 이게 없으면 한 손가락으로 지도를 끌 때 브라우저가 먼저 페이지를 스크롤해
       * 버리고, 두 손가락은 지도가 아니라 페이지를 확대한다.
       */
      className={`stage-bg absolute inset-0 touch-none select-none overflow-hidden ${cursor}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      <MapCanvas engine={engine} width={size.width} height={size.height} />
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0" />
      <LayerToast />
      {/*
        **마우스 전용이다** (S15P21A405-593). 손가락에는 호버가 없고, 폰에서는 별을 누르면
        곡 상세가 바로 1 단으로 열린다 — 카드를 거칠 일이 없어졌다. 예전에는 폰에서도 이
        카드를 띄우고 그 안의 `상세` 버튼으로 들어갔는데 (S15P21A405-417), 카드가 z-25 라
        패널(z-20) 위에 얹혀 "UI 가 뚫고 나왔다" 는 말이 계속 나오던 자리이기도 하다.
      */}
      <HoverCard engine={engine} song={hoverSong} on={cardOn} />
      {!songs && <StarfieldPlaceholder width={size.width} height={size.height} failed={songsFailed} />}
    </div>
  );
}
