"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { STORAGE_KEYS } from "@/constants";
import { useConstellationLayoutQuery } from "@/hooks/queries/use-constellation-layout-query";
import { useMapSongsQuery } from "@/hooks/queries/use-map-songs-query";
import { useNearbyQuery } from "@/hooks/queries/use-nearby-query";
import { useNearbyUsersQuery } from "@/hooks/queries/use-nearby-users-query";
import { useRepresentativesQuery } from "@/hooks/queries/use-representatives-query";
import { useMockFriendReactions } from "@/hooks/use-mock-friend-reactions";
import { readStorage, writeStorage } from "@/lib/storage";
import { useFollowStore } from "@/stores/use-follow-store";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { registerMapEngine } from "./engine/engine-registry";
import { MapEngine } from "./engine/map-engine";
import FloatingReactions from "./floating-reactions";
import LayerToast from "./layer-toast";
import MapCanvas from "./map-canvas";
import { useViewport } from "./use-viewport";

interface MapViewProps {
  /** 우측 패널·레일 등으로 가려진 폭(px). 중앙 계산에서 제외한다 */
  occludedRight: number;
}

/**
 * 스테이지 전체를 채우는 별지도. 엔진을 소유하고 스토어/쿼리와 엔진을 연결한다.
 * 입력: 휠 = 확대(게이트 열리면 압력 → 파고들기/떠오르기) · 드래그 = 이동 · 클릭 = 곡 선택 / 친구 프로필
 */
export default function MapView({ occludedRight }: MapViewProps) {
  const engine = useMemo(() => new MapEngine(), []);
  const { ref, size } = useViewport();
  const [hover, setHover] = useState(false);
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
  const { data: layout } = useConstellationLayoutQuery(constellationMusicIds);
  const selectedMusicId = useMapStore((s) => s.selectedMusicId);
  const myMusicId = useMapStore((s) => s.myMusicId);
  const selectMusic = useMapStore((s) => s.selectMusic);
  const syncFromEngine = useMapStore((s) => s.syncFromEngine);
  const openSong = usePanelStore((s) => s.openSong);
  const openFeed = usePanelStore((s) => s.openFeed);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
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

  // 이 겹의 상주 집합이 도착하면 엔진에 넣는다. 첫 진입이면 저장된 내 곡 자리에서 시작
  useEffect(() => {
    if (!songs) return;
    if (!engine.ready) engine.setInitialMy(readStorage<number>(STORAGE_KEYS.myMusicId));
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
    if (viewMode === "nearby" && nearby) engine.enterProbe(nearby.center.musicId, nearby.neighbors.map((n) => n.musicId));
    else if (viewMode !== "nearby") engine.exitProbe();
  }, [engine, viewMode, nearby]);
  // 별자리 오버레이 뷰: 배치가 도착하면 대형으로 모이고, 뷰를 닫으면 제자리로 흩어진다 (PATH-01)
  useEffect(() => {
    if (viewMode === "constellation" && layout) engine.enterConstellation(constellationMusicIds, layout.points);
    else if (viewMode !== "constellation") engine.exitConstellation();
  }, [engine, viewMode, constellationMusicIds, layout]);
  useEffect(() => engine.setSelected(selectedMusicId), [engine, selectedMusicId]);

  // 재생 → 내 위치가 그 곡으로 이동 (MAP-08)
  useEffect(() => {
    if (currentMusicId != null) engine.travelTo(currentMusicId);
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

  // 내 곡 영구 저장
  useEffect(() => {
    if (myMusicId != null) writeStorage(STORAGE_KEYS.myMusicId, myMusicId);
  }, [myMusicId]);

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
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const hitF = engine.hitFriend(mx, my);
      const hit = hitF ? null : engine.hitTest(mx, my);
      engine.setHover(hit ? engine.songs[hit.i].musicId : null);
      setHover(!!hit || !!hitF);
    },
    [engine],
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
      // 오버레이가 떠 있으면 그 안의 곡만 고를 수 있다 (뒷화면 별은 클릭되지 않는다)
      const overlayIds = engine.constellationIdSet() ?? engine.probeIdSet();
      if (overlayIds && !overlayIds.has(id)) return;
      // 여정 지정 모드면 클릭이 출발·도착 칸을 번갈아 채운다 (JOURNEY-01)
      const journey = useJourneyStore.getState();
      if (journey.pickTarget) {
        journey.pickForNext(id);
        selectMusic(id);
        return;
      }
      selectMusic(id);
      openSong(id);
      // 누른 별로 뷰만 옮긴다 — '나'는 재생할 때만 움직인다 (MAP-08)
      if (useMapStore.getState().viewMode === "default") engine.focus(id);
      useTutorialStore.getState().complete("select");
    },
    [engine, openFeed, openSong, selectMusic],
  );
  const onMouseLeave = useCallback(() => {
    drag.current = null;
    engine.setHover(null);
    setHover(false);
  }, [engine]);

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
      {!songs && <p className="lbl pointer-events-none absolute inset-0 flex items-center justify-center">loading stars</p>}
    </div>
  );
}
