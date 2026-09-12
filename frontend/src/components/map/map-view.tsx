"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { HOVER_CARD, STORAGE_KEYS } from "@/constants";
import type { LayerBox, MapPoint } from "@/types";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { useConstellationLayoutQuery } from "@/hooks/queries/use-constellation-layout-query";
import { useMapSongsQuery } from "@/hooks/queries/use-map-songs-query";
import { useNearbyQuery } from "@/hooks/queries/use-nearby-query";
import { useNearbyUsersQuery } from "@/hooks/queries/use-nearby-users-query";
import { useRepresentativesQuery } from "@/hooks/queries/use-representatives-query";
import { useMockFriendReactions } from "@/hooks/use-mock-friend-reactions";
import { readStorage, writeStorage } from "@/lib/storage";
import { openYoutube } from "@/lib/youtube";
import { useFollowStore } from "@/stores/use-follow-store";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { registerMapEngine } from "./engine/engine-registry";
import { MapEngine } from "./engine/map-engine";
import FloatingReactions from "./floating-reactions";
import HoverCard from "./hover-card";
import LayerToast from "./layer-toast";
import MapCanvas from "./map-canvas";
import { useViewport } from "./use-viewport";

interface MapViewProps {
  /** 우측 패널·레일 등으로 가려진 폭(px). 중앙 계산에서 제외한다 */
  occludedRight: number;
}

/**
 * 스테이지 전체를 채우는 별지도. 엔진을 소유하고 스토어/쿼리와 엔진을 연결한다.
 * 입력: 휠 = 확대(게이트 열리면 압력 → 파고들기/떠오르기) · 드래그 = 이동 · 클릭 = 그 곡 상세(뷰만 이동) / 친구 프로필
 *
 * **보는 곡과 내 위치는 다른 값이다** (S15P21A405-277). 클릭은 보는 곡만 바꾸고, 내 위치(우주선)는
 * 재생했을 때만 옮겨간다 — 엔진 `FollowState` 주석이 적어 둔 SOCIAL-07 의 두 단계와 같은 구분이다.
 */
export default function MapView({ occludedRight }: MapViewProps) {
  const engine = useMemo(() => new MapEngine(), []);
  const { ref, size } = useViewport();
  const [hover, setHover] = useState(false);
  /** 호버 카드에 띄울 곡. 카드가 DOM 이라 곡 자체를 들고 있어야 한다 */
  const [hoverSong, setHoverSong] = useState<MapPoint | null>(null);
  /** 카드가 켜져 있나. 꺼져도 사라지는 동안에는 `hoverSong` 이 남아 있는다 */
  const [cardOn, setCardOn] = useState(false);
  /** 호버 카드의 DOM. 마우스가 그 위인지 매번 다시 재려고 들고 있는다 */
  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  // 겹마다 그 겹의 상주 집합을 받는다 — boxes(누적 범위)가 곧 요청 조건이자 캐시 키다
  const boxes = useMapStore((s) => s.boxes);
  const { data: songs } = useMapSongsQuery(boxes);
  const layer = useMapStore((s) => s.layer);
  const { data: friends } = useNearbyUsersQuery(layer);
  const { data: representatives } = useRepresentativesQuery(layer);
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const constellationMusicIds = useMapStore((s) => s.constellationMusicIds);
  const constellationPoints = useMapStore((s) => s.constellationPoints);
  const { data: layout } = useConstellationLayoutQuery(constellationMusicIds, constellationPoints);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const myMusicId = useMapStore((s) => s.myMusicId);
  const home = useMapStore((s) => s.home);
  const selectMusic = useMapStore((s) => s.selectMusic);
  const syncFromEngine = useMapStore((s) => s.syncFromEngine);
  const openSong = usePanelStore((s) => s.openSong);
  const openFeed = usePanelStore((s) => s.openFeed);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const playSingle = usePlayerStore((s) => s.playSingle);
  const { mutate: recordPlay } = useRecordPlayMutation();
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const pickTarget = useJourneyStore((s) => s.pickTarget);
  const { data: nearby } = useNearbyQuery(viewMode === "nearby" ? nearbyCenterMusicId : null);
  // 목: 지도 위 사용자들이 스스로 반응을 쏜다 (실서비스에서는 소켓 수신)
  useMockFriendReactions(friends);

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

  useEffect(() => engine.setOcclusion(occludedRight), [engine, occludedRight]);

  /**
   * 지도 위에 떠 있는 HUD 상자를 재서 엔진에 넘긴다 — 화면 밖 표식이 여기에 가리지 않게 한다.
   * 상수로 박으면 패널이 열리고 닫힐 때마다 틀어지므로 **실제 DOM 을 잰다.**
   * 패널 전환은 애니메이션이 있어서 조금 뒤에 한 번 더 잰다.
   */
  useEffect(() => {
    const measure = () => {
      const host = document.querySelector("canvas")?.getBoundingClientRect();
      if (!host) return;
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
  }, [engine, occludedRight, viewMode]);

  // 이 겹의 상주 집합이 도착하면 엔진에 넣는다. 첫 진입이면 저장된 내 곡 자리에서 시작
  useEffect(() => {
    if (!songs) return;
    if (!engine.ready) {
      engine.setInitialMy(readStorage<number>(STORAGE_KEYS.myMusicId));
      // 돌아갈 자리까지 되살려야 새로고침 뒤에도 "내 위치로 가기" 가 먹는다 (S15P21A405-275)
      engine.restoreHome(readStorage<{ musicId: number; boxes: LayerBox[] }>(STORAGE_KEYS.myHome));
    }
    engine.setLayerSongs(boxes.length, songs);
  }, [engine, boxes, songs]);
  // 레이어별 데이터 — 새 레이어 것이 도착하면 엔진이 페이드인한다
  useEffect(() => {
    if (friends) engine.setFriends(layer, friends);
  }, [engine, layer, friends]);
  useEffect(() => {
    if (representatives) engine.setRepresentatives(representatives.layer, representatives.musicIds);
  }, [engine, representatives]);

  // 주변 탐색: 유사곡 10곡이 오면 연출 뷰로 진입, 모드가 꺼지면 복귀
  useEffect(() => {
    if (viewMode === "nearby" && nearby) engine.enterProbe(nearby.center, nearby.neighbors);
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

  // 재생 → 내 위치가 그 곡으로 이동 (MAP-08)
  useEffect(() => {
    if (currentMusicId == null) return;
    // 되살린 값은 "지금 막 재생한 것" 이 아니다 — 한 번만 흘려보낸다
    if (currentMusicId === restoredPlaying.current) {
      restoredPlaying.current = null;
      return;
    }
    engine.travelTo(currentMusicId);
  }, [engine, currentMusicId]);

  // 따라가기 (SOCIAL-06 ~ 09)
  useEffect(() => {
    if (!leaderEmail) {
      engine.stopFollow();
      return;
    }
    const leader = (friends ?? []).find((f) => f.email === leaderEmail);
    if (leader) engine.startFollow(leader);
  }, [engine, leaderEmail, friends]);

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
      setHoverSong(null);
    }, HOVER_CARD.fadeMs);
    return () => clearTimeout(t);
  }, [engine, cardOn, hoverSong]);
  useEffect(() => cancelHide, [cancelHide]);

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const mode = useMapStore.getState().viewMode;
      // 오버레이가 떠 있으면 뒷화면 지도는 건드리지 않는다 — 휠은 오버레이 안에서만 작동
      if (mode === "constellation") {
        engine.overlayWheel(e.deltaY, e.clientX - r.left, e.clientY - r.top);
        return;
      }
      // 주변 탐색 중 줌아웃 → 모드 해제 (곡들이 실제 자리로 돌아간다)
      if (mode === "nearby") {
        if (e.deltaY > 0) useMapStore.getState().exitNearby();
        return;
      }
      const res = engine.wheel(e.deltaY, e.clientX - r.left, e.clientY - r.top);
      if (res === "zoom") useTutorialStore.getState().complete("zoom");
    },
    [engine],
  );
  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
  }, []);
  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      if (drag.current) {
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        const mode = useMapStore.getState().viewMode;
        // 오버레이 안에서는 별자리만 움직인다 (뒷화면 지도는 그대로)
        if (mode === "constellation") engine.overlayPan(dx, dy);
        else if (mode !== "nearby") engine.dragBy(dx, dy);
        return;
      }
      // 카드 위로 넘어간 마우스는 "별에서 벗어난 것" 이 아니다 — 카드를 유지한다.
      // 들어왔다/나갔다를 플래그로 기억하면 카드가 포인터 밑에서 사라질 때 굳는다 (지워진 요소는
      // mouseleave 를 쏘지 않는다). 그래서 매번 지금 자리로 다시 잰다
      if (cardRef.current?.contains(e.target as Node)) {
        cancelHide();
        return;
      }
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const hitF = engine.hitFriend(mx, my);
      const hit = hitF ? null : engine.hitTest(mx, my);
      const song = hit ? engine.songs[hit.i] : null;
      if (song) {
        cancelHide();
        engine.setHover(song.musicId);
        setHoverSong(song);
        setCardOn(true);
      } else scheduleHide();
      setHover(!!hit || !!hitF);
    },
    [engine, cancelHide, scheduleHide],
  );
  const onMouseUp = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.moved > 5) return;
      const r = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const fr = engine.hitFriend(mx, my);
      if (fr) {
        openFeed(fr.user.email);
        return;
      }
      if (engine.follow) return;
      // 고스트별을 누르면 상세만 열고 화면은 그대로 둔다 — 이동은 상세 안 버튼으로 (MAP-12)
      const gid = engine.hitGhost(mx, my);
      if (gid != null) {
        selectMusic(gid);
        openSong(gid);
        return;
      }
      const hit = engine.hitTest(mx, my);
      if (!hit) return;
      const id = engine.songs[hit.i].musicId;
      // 오버레이가 **떠 있는 동안에만** 그 안의 곡으로 가둔다 (PATH-01-1).
      // 닫힌 뒤에도 가두면 지도의 별이 영영 안 눌린다 — 실제로 그랬다 (S15P21A405-270)
      const overlayIds = engine.clickableOverlayIds();
      if (overlayIds && !overlayIds.has(id)) return;
      // 여정 지정 모드면 클릭이 출발·도착 칸을 번갈아 채운다 (JOURNEY-01)
      const journey = useJourneyStore.getState();
      if (journey.pickTarget) {
        journey.pickForNext(id);
        selectMusic(id);
        return;
      }
      // 클릭 = **보기만** (S15P21A405-277). 상세를 열고 뷰만 그리로 옮긴다 —
      // 내 위치는 제자리고, 선택 링만 붙는다. 우주선은 재생해야 날아간다
      selectMusic(id);
      openSong(id);
      engine.viewSong(id);
      useTutorialStore.getState().complete("select");
    },
    [engine, openFeed, openSong, selectMusic],
  );
  const onMouseLeave = useCallback(() => {
    drag.current = null;
    scheduleHide();
    setHover(false);
  }, [scheduleHide]);

  /**
   * 호버 카드의 재생 — 상세를 열면서 동시에 재생한다.
   * 내 위치는 `currentMusicId` 가 바뀌는 것을 보고 위쪽 이펙트가 옮긴다 (재생 = 이동, 한 자리에서만).
   */
  const handleCardPlay = useCallback(
    (s: MapPoint) => {
      selectMusic(s.musicId);
      openSong(s.musicId);
      openYoutube(s.youtubeUrl);
      playSingle(s.musicId);
      recordPlay({ musicId: s.musicId, source: "MAP", playedMs: 0 });
      useTutorialStore.getState().complete("select");
    },
    [openSong, playSingle, recordPlay, selectMusic],
  );

  const following = leaderEmail != null;
  const cursor = following ? "cursor-not-allowed" : pickTarget ? "cursor-crosshair" : hover ? "cursor-pointer" : "cursor-grab active:cursor-grabbing";

  return (
    <div
      ref={ref}
      className={`stage-bg absolute inset-0 select-none overflow-hidden ${cursor}`}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <MapCanvas engine={engine} width={size.width} height={size.height} />
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0" />
      <LayerToast />
      <FloatingReactions />
      <HoverCard engine={engine} song={hoverSong} cardRef={cardRef} on={cardOn} onPlay={handleCardPlay} />
      {!songs && <p className="lbl pointer-events-none absolute inset-0 flex items-center justify-center">loading stars</p>}
    </div>
  );
}
