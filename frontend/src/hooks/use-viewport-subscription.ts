"use client";

import { useEffect, useRef, useState } from "react";
import { NO_GENRE_ID, REALTIME } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { expect, onConnectionChange, onType, send, settle } from "@/lib/realtime/stomp-client";
import { useMapStore } from "@/stores/use-map-store";
import type { CrowdCell, LayerBox, NearbyUser, ViewportCellCounts, ViewportDelta, ViewportSnapshot } from "@/types";

/**
 * 지도 위 사람 (S15P21A405-482, 실시간 작업명세 §5).
 *
 * **폴링이 아니다.** 지금 보고 있는 화면 범위를 한 번 보내면 그 안의 사람을 스냅샷으로 받고,
 * 이후 변화는 델타로 밀려온다.
 *
 * 두 모드가 **화면 구성이 완전히 다르다.** `INDIVIDUAL` 은 사람을 한 명씩(그리고 델타가 온다),
 * `CLUSTERED` 는 "N명" 뭉치만(개별 델타 없이 5초마다 전체 교체). 둘을 같은 상태에 섞으면
 * 모드가 바뀔 때 이전 모드의 잔재가 남는다 — 그래서 스냅샷을 받을 때마다 반대쪽을 비운다.
 */

/** 뷰포트 전용 카운터. **join 카운터와 별개다** (§5.1) */
let viewportSeq = 0;
const VIEWPORT_KEY = "presence/viewport";

/** `boxes` 를 이름만 바꿔 복사한다. 길이 = layer, `bounds[i].layer === i` 순서 (§5.1) */
export function toViewportRequest(seq: number, boxes: readonly LayerBox[], view: LayerBox) {
  return {
    requestSeq: seq,
    layer: boxes.length,
    minX: view.xMin,
    maxX: view.xMax,
    minY: view.yMin,
    maxY: view.yMax,
    ancestorBounds: boxes.map((b) => ({ layer: b.layer, minX: b.xMin, maxX: b.xMax, minY: b.yMin, maxY: b.yMax })),
  };
}

/** 절차적 아바타 시드 — 목 시절과 같은 방식이라 같은 사람은 같은 얼굴이다 */
function seedOf(email: string): number[] {
  let h = 2166136261;
  for (const ch of email) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  return Array.from({ length: 6 }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return ((h >>> (i % 8)) % 1000) / 1000;
  });
}

/**
 * 서버가 주지 않는 `NearbyUser` 필드를 채운다 (§5.6).
 *
 * `isOnline` 은 **항상 true** 다 — 목록에 있다는 것이 곧 접속 중이라는 뜻이다. `isPublic` 도
 * 항상 true 이고(비공개 계정이 아직 없다), `meetingCount` 는 0 이다(뷰포트에는 오지 않고
 * 주변 사람 패널에만 있다). `viewingMusicId` 는 `musicId` 와 같게 둔다 — 따라가기가 없어
 * "보고 있는 곡" 이 따로 오지 않는다.
 */
function toNearbyUser(p: {
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  riderCount: number | null;
  musicId: number;
  x: number;
  y: number;
}): NearbyUser {
  return {
    email: p.email,
    nickname: p.nickname,
    imageUrl: p.imageUrl,
    isOnline: true,
    isPublic: true,
    musicId: p.musicId,
    viewingMusicId: p.musicId,
    genreId: getMapEngine()?.genreOf(p.musicId) ?? NO_GENRE_ID,
    meetingCount: 0,
    riderCount: p.riderCount ?? 0,
    followingNickname: null,
    avatarSeed: seedOf(p.email),
    x: p.x,
    y: p.y,
  };
}

/**
 * 지금 화면 범위를 보낸다.
 *
 * 컴포넌트 밖에 둔다 — 스토어와 엔진에서 직접 읽으므로 렌더 상태가 필요 없고, 타임아웃에서
 * 자기 자신을 다시 부르는 자리(§12.3)라 `useCallback` 안에서는 자기 참조가 안 된다.
 */
function pushViewport(): void {
  const e = getMapEngine();
  if (!e) return;
  viewportSeq += 1;
  const ok = send(REALTIME.send.viewport, toViewportRequest(viewportSeq, useMapStore.getState().boxes, e.viewBox()));
  // 응답도 오류도 없으면 한 번 더 보낸다. 소켓은 조용히 실패할 수 있다
  if (ok) expect(VIEWPORT_KEY, pushViewport);
}

export function useViewportSubscription(enabled: boolean): void {
  const layer = useMapStore((s) => s.layer);
  const boxes = useMapStore((s) => s.boxes);
  const morph = useMapStore((s) => s.morph);
  const [people, setPeople] = useState<Map<string, NearbyUser>>(() => new Map());
  const [crowd, setCrowd] = useState<CrowdCell[]>([]);
  /** 지금 모드. 반대 모드의 프레임을 버리는 기준이다 */
  const mode = useRef<ViewportSnapshot["mode"] | null>(null);

  // 겹이 바뀌면 다시 보낸다. **join 다음이다** — 순서가 바뀌면 내 표식이 이전 겹에 남는다 (§3.2).
  // `prefetchBoxes` 만으로는 보내지 않는다. layer·boxes 가 실제로 바뀐 뒤다
  useEffect(() => {
    if (!enabled || morph) return;
    const id = window.setTimeout(pushViewport, REALTIME.viewportDebounceMs);
    return () => window.clearTimeout(id);
  }, [enabled, morph, layer, boxes]);

  // 재연결하면 서버 쪽 구독이 없다. join 다음에 다시 보낸다 (§12.4)
  useEffect(() => (enabled ? onConnectionChange((up) => up && pushViewport()) : undefined), [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const stopSnap = onType<ViewportSnapshot>(["VIEWPORT_SNAPSHOT"], (p) => {
      settle(VIEWPORT_KEY);
      // 늦게 도착한 옛 화면의 결과다 (§5.2)
      if (p.requestSeq !== viewportSeq) return;
      mode.current = p.mode;
      if (p.mode === "INDIVIDUAL") {
        const next = new Map<string, NearbyUser>();
        for (const g of p.groups) for (const u of g.users) next.set(u.email, toNearbyUser({ ...u, musicId: g.musicId, x: g.x, y: g.y }));
        setPeople(next);
        setCrowd([]);
      } else {
        setCrowd(p.cells.map((c) => ({ x: c.x, y: c.y, count: c.count })));
        setPeople(new Map());
      }
    });

    // 개별 델타는 INDIVIDUAL 일 때만 온다 (§5.3)
    const stopDelta = onType<ViewportDelta>(["VIEWPORT_ENTER", "VIEWPORT_MOVE", "VIEWPORT_LEAVE"], (p, msg) => {
      if (p.requestSeq !== viewportSeq || mode.current !== "INDIVIDUAL") return;
      setPeople((prev) => {
        const next = new Map(prev);
        if (msg.type === "VIEWPORT_LEAVE") {
          next.delete(p.email);
          return next;
        }
        // LEAVE 가 아니면 좌표가 온다. 없으면 그릴 수 없으니 무시한다
        if (p.musicId == null || p.x == null || p.y == null) return prev;
        next.set(p.email, toNearbyUser({ ...p, musicId: p.musicId, x: p.x, y: p.y }));
        return next;
      });
    });

    // 뭉치는 5초마다 **통째로 교체**된다. 0 인 자리는 아예 오지 않는다 (§5.4)
    const stopCells = onType<ViewportCellCounts>(["VIEWPORT_CELL_COUNTS"], (p) => {
      if (p.requestSeq !== viewportSeq || mode.current !== "CLUSTERED") return;
      setCrowd(p.cells.map((c) => ({ x: c.x, y: c.y, count: c.count })));
    });

    return () => {
      stopSnap();
      stopDelta();
      stopCells();
    };
  }, [enabled]);

  // 엔진에 넘긴다. 레이어를 함께 줘야 겹이 바뀌는 순간 이전 겹의 사람이 남지 않는다
  useEffect(() => {
    getMapEngine()?.setFriends(layer, [...people.values()]);
  }, [layer, people]);
  useEffect(() => {
    getMapEngine()?.setCrowd(layer, crowd);
  }, [layer, crowd]);

  // 지도를 떠날 때 닫는다. 안 보내도 새 요청이 이전 것을 덮지만, 보내면 바로 멎는다 (§5.5)
  useEffect(() => {
    if (!enabled) return;
    return () => {
      send(REALTIME.send.viewportClose, { requestSeq: viewportSeq });
    };
  }, [enabled]);
}
