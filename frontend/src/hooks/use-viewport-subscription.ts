"use client";

import { useEffect, useRef, useState } from "react";
import { NO_GENRE_ID, REALTIME } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { seedOf } from "@/lib/avatar-seed";
import { botAsNearbyUser } from "@/lib/bots/adapt";
import { expect, onConnectionChange, onType, send, settle } from "@/lib/realtime/stomp-client";
import { useBotStore } from "@/stores/use-bot-store";
import { isRiding } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import type {
  CrowdCell,
  LayerBox,
  NearbyUser,
  ViewportBulkEnter,
  ViewportCellCounts,
  ViewportDelta,
  ViewportRiderCount,
  ViewportSnapshot,
} from "@/types";

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

/**
 * 절차적 아바타 시드. 실제 구현은 [`lib/avatar-seed`](../lib/avatar-seed.ts) 로 옮겼다
 * (S15P21A405-536) — 봇을 `NearbyUser` 로 바꾸는 쪽도 써야 하는데, 거기서 이 훅을 부르면
 * 두 모듈이 서로를 가리킨다. 부르던 자리를 안 고치려고 이름만 여기서 다시 내보낸다.
 */
export { seedOf };

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
export function pushViewport(): void {
  const e = getMapEngine();
  if (!e) return;
  /**
   * **따라가는 동안에는 내 화면을 만들지 않는다** (2차 명세 §4.2·§6, S15P21A405-530).
   * 인솔자가 받은 화면을 `RIDE_VIEWPORT*` 로 옮겨 받으므로 내 요청은 보낼 이유도 없고,
   * 서버가 `RIDE_NOT_CAPTAIN` 으로 거부한다.
   */
  if (isRiding()) return;
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
  /** 데모 봇 (S15P21A405-536). 굴리는 쪽은 `use-bots` 하나고 여기는 읽기만 한다 */
  const bots = useBotStore((s) => s.bots);
  const [crowd, setCrowd] = useState<CrowdCell[]>([]);
  /** 지금 모드. 반대 모드의 프레임을 버리는 기준이다 */
  const mode = useRef<ViewportSnapshot["mode"] | null>(null);
  /** 옮겨 받은 화면(`RIDE_VIEWPORT*`)의 마지막 번호. **인솔자의 번호라 내 것과 섞지 않는다** */
  const ridingSeq = useRef(0);

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

    /**
     * **`RIDE_VIEWPORT*` 는 내 번호로 거르면 안 된다** (2차 명세 §4.2, S15P21A405-530).
     * 그 `requestSeq` 는 **인솔자의** 화면 요청 번호다. 내 번호와 견주면 전부 버려져 지도가
     * 통째로 비고, 오류도 안 뜬다 — 이름을 가른 이유가 바로 이것이다.
     *
     * 대신 옮겨 받은 것끼리만 단조성을 본다. 인솔자가 화면을 옮기면 번호가 오르므로, 그보다
     * 작은 번호는 늦게 도착한 옛 화면이다.
     */
    const fresh = (requestSeq: number, ride: boolean) => {
      if (!ride) return requestSeq === viewportSeq;
      if (requestSeq < ridingSeq.current) return false;
      ridingSeq.current = requestSeq;
      return true;
    };

    const applySnapshot = (p: ViewportSnapshot) => {
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
    };

    const stopSnap = onType<ViewportSnapshot>(["VIEWPORT_SNAPSHOT", "RIDE_VIEWPORT"], (p, msg) => {
      const ride = msg.type === "RIDE_VIEWPORT";
      if (!ride) settle(VIEWPORT_KEY);
      // 늦게 도착한 옛 화면의 결과다 (§5.2)
      if (!fresh(p.requestSeq, ride)) return;
      applySnapshot(p);
    });

    // 개별 델타는 INDIVIDUAL 일 때만 온다 (§5.3)
    const stopDelta = onType<ViewportDelta>(
      ["VIEWPORT_ENTER", "VIEWPORT_MOVE", "VIEWPORT_LEAVE", "RIDE_VIEWPORT_ENTER", "RIDE_VIEWPORT_MOVE", "RIDE_VIEWPORT_LEAVE"],
      (p, msg) => {
        const ride = msg.type.startsWith("RIDE_");
        if (!fresh(p.requestSeq, ride) || mode.current !== "INDIVIDUAL") return;
        setPeople((prev) => {
          const next = new Map(prev);
          if (msg.type === "VIEWPORT_LEAVE" || msg.type === "RIDE_VIEWPORT_LEAVE") {
            next.delete(p.email);
            return next;
          }
          // LEAVE 가 아니면 좌표가 온다. 없으면 그릴 수 없으니 무시한다
          if (p.musicId == null || p.x == null || p.y == null) return prev;
          next.set(p.email, toNearbyUser({ ...p, musicId: p.musicId, x: p.x, y: p.y }));
          return next;
        });
      },
    );

    // 뭉치는 5초마다 **통째로 교체**된다. 0 인 자리는 아예 오지 않는다 (§5.4)
    const stopCells = onType<ViewportCellCounts>(["VIEWPORT_CELL_COUNTS", "RIDE_VIEWPORT_CELL_COUNTS"], (p, msg) => {
      if (!fresh(p.requestSeq, msg.type.startsWith("RIDE_")) || mode.current !== "CLUSTERED") return;
      setCrowd(p.cells.map((c) => ({ x: c.x, y: c.y, count: c.count })));
    });

    /**
     * 선단이 흩어져 여럿이 **한 자리에** 나타났다 (2차 명세 §7.2).
     *
     * 좌표는 하나뿐이다 — 전원이 인솔자의 마지막 곡에 남기 때문이다. 한 덩어리로 받았으니
     * **한 번만 다시 그린다.** 한 명씩 `setPeople` 을 부르면 이 메시지를 만든 의미가 없어진다.
     */
    const stopBulk = onType<ViewportBulkEnter>(["VIEWPORT_BULK_ENTER", "RIDE_VIEWPORT_BULK_ENTER"], (p, msg) => {
      if (!fresh(p.requestSeq, msg.type.startsWith("RIDE_")) || mode.current !== "INDIVIDUAL") return;
      setPeople((prev) => {
        const next = new Map(prev);
        for (const u of p.users) next.set(u.email, toNearbyUser({ ...u, musicId: p.musicId, x: p.x, y: p.y }));
        return next;
      });
    });

    /**
     * 인원수만 바뀌었다 (2차 명세 §7.1). **자리는 건드리지 않는다** — 좌표가 오지 않는다.
     * 이게 없으면 스무 명이 타고 내려도 구경하는 쪽에는 계속 같은 수로 보인다.
     */
    const stopRiders = onType<ViewportRiderCount>(["VIEWPORT_RIDER_COUNT", "RIDE_VIEWPORT_RIDER_COUNT"], (p, msg) => {
      if (!fresh(p.requestSeq, msg.type.startsWith("RIDE_"))) return;
      setPeople((prev) => {
        const had = prev.get(p.email);
        if (!had || had.riderCount === p.riderCount) return prev;
        const next = new Map(prev);
        next.set(p.email, { ...had, riderCount: p.riderCount });
        return next;
      });
    });

    return () => {
      stopSnap();
      stopDelta();
      stopCells();
      stopBulk();
      stopRiders();
    };
  }, [enabled]);

  /**
   * 엔진에 넘긴다. 레이어를 함께 줘야 겹이 바뀌는 순간 이전 겹의 사람이 남지 않는다.
   *
   * **데모 봇을 여기서 섞는다** (S15P21A405-536). 엔진에 봇 전용 목록을 따로 두지 않는 이유는
   * `friends` 를 읽는 자리가 그리기 경로 전반에 흩어져 있어서다 — 배열 하나를 합쳐 주는 편이
   * 그 자리들을 하나도 안 건드린다. 지금 겹에 있는 봇만 들어간다.
   */
  useEffect(() => {
    const withBots = [...people.values()];
    for (const bot of bots) {
      if (bot.episode.layer !== layer) continue;
      const as = botAsNearbyUser(bot);
      if (as) withBots.push(as);
    }
    getMapEngine()?.setFriends(layer, withBots);
  }, [layer, people, bots]);
  useEffect(() => {
    getMapEngine()?.setCrowd(layer, crowd);
  }, [layer, crowd]);

  // 지도를 떠날 때 닫는다. 안 보내도 새 요청이 이전 것을 덮지만, 보내면 바로 멎는다 (§5.5)
  useEffect(() => {
    if (!enabled) return;
    return () => {
      // 따라가는 중이면 이 경로도 막혀 있다 (2차 명세 §6). 서버가 이미 내 구독을 끊어 뒀다
      if (isRiding()) return;
      send(REALTIME.send.viewportClose, { requestSeq: viewportSeq });
    };
  }, [enabled]);
}
