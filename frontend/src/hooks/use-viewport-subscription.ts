"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NO_GENRE_ID, REALTIME } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { useLayerUsersQuery } from "@/hooks/queries/use-layer-users-query";
import { seedOf } from "@/lib/avatar-seed";
import { botAsNearbyUser } from "@/lib/bots/adapt";
import { expect, onConnectionChange, onType, send, settle } from "@/lib/realtime/stomp-client";
import { useBotStore } from "@/stores/use-bot-store";
import { isRiding } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import type {
  CrowdCell,
  LayerBox,
  LayerUsersSnapshot,
  NearbyUser,
  ViewportBulkEnter,
  ViewportMusicGroup,
  ViewportDelta,
  ViewportRiderCount,
  ViewportSnapshot,
} from "@/types";

/**
 * 지도 위 사람 (S15P21A405-482 · 537, 실시간 작업명세 §5, BACKEND-NOTES §5).
 *
 * **출처가 둘이고 역할이 다르다.**
 *
 * | 출처 | 무엇을 주나 | 언제 |
 * | --- | --- | --- |
 * | `GET /bff/realtime/layers/{layer}/users` | **그 겹의 사람 전부** (기준) | 겹을 옮길 때 + 10초마다 |
 * | 소켓 `VIEWPORT_*` · `RIDE_VIEWPORT_*` | 그 사이의 변화 (얹는 것) | 일어나는 즉시 |
 *
 * 겹 조회가 기준을 깔고 델타가 그 위를 덮는다. 합치는 규칙은 {@link mergePeople} 에 있다.
 *
 * **왜 조회가 기준인가** (S15P21A405-537): 지도는 줌과 상관없이 사람을 전부 한 명씩 그리기로
 * 했는데(팀 결정), 소켓 스냅샷은 **보이는 범위만** 주고 칸이 36개를 넘으면 "N명" 뭉치
 * (`CLUSTERED`)로 바뀐다. 그 모드에서는 개별로 그릴 재료가 아예 없다. 그래서 뭉치를 지도에
 * 그리던 길을 걷어내고 겹 전체 조회를 바탕으로 깔았다.
 *
 * **소켓을 버리지 않은 이유**는 더 빠르기 때문이다. 조회는 10초마다 도는데 델타는 즉시 온다.
 * 그리고 따라가는 동안에는 `RIDE_VIEWPORT_*` 가 인솔자 화면을 옮겨 주는 유일한 길이다.
 */

/** 뷰포트 전용 카운터. **join 카운터와 별개다** (§5.1) */
let viewportSeq = 0;
const VIEWPORT_KEY = "presence/viewport";

/** 같은 참조를 써서 엔진이 매번 새 배열을 받고 다시 그리지 않게 한다 */
const EMPTY_CROWD: CrowdCell[] = [];
/** 비울 때마다 새 Map 을 만들면 그 자체로 `people` 이 다시 계산된다 */
const EMPTY_OVERLAY: Map<string, NearbyUser | null> = new Map();
const EMPTY_RIDER_COUNTS: Map<string, number> = new Map();

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
 * 기준 목록 위에 소켓 델타를 얹어 **지도에 그릴 사람들**을 만든다 (S15P21A405-537).
 *
 * 순서가 규칙이다. 겹 조회가 바탕을 깔고, 얹은 것이 그 위를 덮고(`null` 이면 지운다),
 * 좌표 없이 숫자만 온 인원수 변경이 **맨 마지막에** 인원수만 바꾼다. 인원수를 먼저 덮으면
 * 그 뒤에 온 자리 변경이 숫자를 옛것으로 되돌린다.
 *
 * 훅 밖에 둔 것은 **시험하려고**다 — 소켓도 React 도 없이 이 규칙만 고정할 수 있다.
 */
export function mergePeople(
  groups: ViewportMusicGroup[] | undefined,
  overlay: Map<string, NearbyUser | null>,
  riderCounts: Map<string, number>,
): Map<string, NearbyUser> {
  const next = new Map<string, NearbyUser>();
  for (const g of groups ?? []) {
    for (const u of g.users) next.set(u.email, toNearbyUser({ ...u, musicId: g.musicId, x: g.x, y: g.y }));
  }
  for (const [email, u] of overlay) {
    if (u) next.set(email, u);
    else next.delete(email);
  }
  for (const [email, riderCount] of riderCounts) {
    const had = next.get(email);
    if (had && had.riderCount !== riderCount) next.set(email, { ...had, riderCount });
  }
  return next;
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
  /**
   * 소켓 델타가 **기준 목록 위에 얹는 것들** (S15P21A405-537).
   *
   * `null` 은 "빠졌다" 는 뜻이다 — 지우는 것도 얹는 것의 한 종류라 같은 자리에 담는다.
   * 다음 겹 조회가 도착하면 그게 새 기준이므로 여기는 비운다.
   */
  const [overlay, setOverlay] = useState<Map<string, NearbyUser | null>>(() => new Map());
  /** 좌표 없이 숫자만 온 인원수 변경 (2차 명세 §7.1). 합칠 때 마지막에 덮는다 */
  const [riderCounts, setRiderCounts] = useState<Map<string, number>>(() => new Map());
  /** 데모 봇 (S15P21A405-536). 굴리는 쪽은 `use-bots` 하나고 여기는 읽기만 한다 */
  const bots = useBotStore((s) => s.bots);
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

    /**
     * 화면 스냅샷은 이제 **덮어쓰지 않고 얹는다** (S15P21A405-537).
     *
     * 지도의 바탕은 겹 전체 조회(`useLayerUsersQuery`)가 깐다 — 줌과 상관없이 사람을 전부 한
     * 명씩 그리기로 했기 때문이다 (팀 결정). 이 스냅샷은 **보이는 범위만** 담고 있어서, 예전처럼
     * 통째로 갈아끼우면 화면 밖 사람이 그때마다 사라진다.
     *
     * 그래도 버리지 않는 이유는 **더 최신이기 때문**이다. 겹 조회는 10초마다 도는데 이건 화면을
     * 움직이는 즉시 온다. 같은 사람이면 이쪽 값이 이긴다.
     *
     * `CLUSTERED` 는 **아무것도 하지 않는다.** 그 모드의 내용은 "N명" 뭉치뿐이라 개별로 그릴
     * 재료가 없다. 뭉치를 지도에 그리던 길은 이 티켓에서 걷어냈다.
     */
    const applySnapshot = (p: ViewportSnapshot) => {
      mode.current = p.mode;
      if (p.mode !== "INDIVIDUAL") return;
      setOverlay((prev) => {
        const next = new Map(prev);
        for (const g of p.groups) for (const u of g.users) next.set(u.email, toNearbyUser({ ...u, musicId: g.musicId, x: g.x, y: g.y }));
        return next;
      });
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
        setOverlay((prev) => {
          const next = new Map(prev);
          if (msg.type === "VIEWPORT_LEAVE" || msg.type === "RIDE_VIEWPORT_LEAVE") {
            // 기준 목록에 있는 사람을 지우려면 "없음" 을 얹어야 한다. 그냥 빼면 기준이 되살아난다
            next.set(p.email, null);
            return next;
          }
          // LEAVE 가 아니면 좌표가 온다. 없으면 그릴 수 없으니 무시한다
          if (p.musicId == null || p.x == null || p.y == null) return prev;
          next.set(p.email, toNearbyUser({ ...p, musicId: p.musicId, x: p.x, y: p.y }));
          return next;
        });
      },
    );

    /**
     * 선단이 흩어져 여럿이 **한 자리에** 나타났다 (2차 명세 §7.2).
     *
     * 좌표는 하나뿐이다 — 전원이 인솔자의 마지막 곡에 남기 때문이다. 한 덩어리로 받았으니
     * **한 번만 다시 그린다.** 한 명씩 얹으면 이 메시지를 만든 의미가 없어진다.
     */
    const stopBulk = onType<ViewportBulkEnter>(["VIEWPORT_BULK_ENTER", "RIDE_VIEWPORT_BULK_ENTER"], (p, msg) => {
      if (!fresh(p.requestSeq, msg.type.startsWith("RIDE_")) || mode.current !== "INDIVIDUAL") return;
      setOverlay((prev) => {
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
      /**
       * **숫자만 따로 담는다.** 좌표가 오지 않아서 사람을 통째로 얹을 수가 없고, 그 사람이
       * 기준 목록에만 있고 아직 안 얹혔을 수도 있다. 합칠 때 마지막에 숫자만 덮는다.
       */
      setRiderCounts((prev) => (prev.get(p.email) === p.riderCount ? prev : new Map(prev).set(p.email, p.riderCount)));
    });

    return () => {
      stopSnap();
      stopDelta();
      stopBulk();
      stopRiders();
    };
  }, [enabled]);

  /**
   * **지도 사람의 바탕은 겹 전체 조회다** (S15P21A405-537, BACKEND-NOTES §5).
   *
   * 받을 때마다 **통째로 갈아끼운다** — 그래야 떠난 사람이 사라진다. 소켓 델타가 그 사이를
   * 메우고(`VIEWPORT_ENTER`/`MOVE`/`LEAVE`), 다음 조회가 다시 기준을 맞춘다.
   *
   * **따라가는 중에는 겹이 어긋날 수 있다** (2차 실시간 명세 §8.4). 인솔자가 층을 옮기면 나도
   * 옮겨지는데 알림이 없어서 `useMapStore.layer` 는 그대로다. 그동안은 인솔자 화면을 옮겨 받는
   * `RIDE_VIEWPORT*` 가 메운다. 겹 알림이 생기면 여기도 그 값을 따라가게 바꾼다.
   */
  const { data: layerUsers } = useLayerUsersQuery(layer, enabled);

  /**
   * 새 기준이 도착하면 그 사이 얹어 둔 것은 **버린다.** 서버가 방금 다시 세어 준 값이라
   * 옛 델타를 남겨 두면 이미 떠난 사람이 되살아난다.
   *
   * 렌더 중에 맞춘다 (React 의 "adjusting state during render"). effect 로 미루면 한 프레임
   * 동안 옛 델타가 새 기준 위에 얹힌 화면이 보인다.
   */
  const [basedOn, setBasedOn] = useState<LayerUsersSnapshot | null>(null);
  if (layerUsers && layerUsers !== basedOn) {
    setBasedOn(layerUsers);
    setOverlay(EMPTY_OVERLAY);
    setRiderCounts(EMPTY_RIDER_COUNTS);
  }

  /** 지도에 실제로 그릴 사람들 = 겹 조회(기준) + 소켓 델타(얹은 것) */
  const people = useMemo(() => mergePeople(layerUsers?.groups, overlay, riderCounts), [layerUsers, overlay, riderCounts]);

  /**
   * 엔진에 넘긴다. 레이어를 함께 줘야 겹이 바뀌는 순간 이전 겹의 사람이 남지 않는다.
   *
   * **데모 봇을 여기서 섞는다** (S15P21A405-536). 엔진에 봇 전용 목록을 따로 두지 않는 이유는
   * `friends` 를 읽는 자리가 그리기 경로 전반에 흩어져 있어서다 — 배열 하나를 합쳐 주는 편이
   * 그 자리들을 하나도 안 건드린다. 지금 겹에 있는 봇만 들어간다.
   *
   * **봇은 겹 조회에 섞지 않는다** (S15P21A405-537). 그쪽은 서버가 준 기준 목록이고, 봇은
   * 브라우저 안에서만 도는 가짜다 — 같은 자리에 담으면 다음 조회가 봇을 "떠난 사람" 으로 보고
   * 지운다. 그릴 때만 한 배열로 합친다.
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
  /**
   * **"N명" 뭉치는 더 이상 지도에 그리지 않는다** (S15P21A405-537).
   *
   * 줌과 상관없이 사람을 전부 한 명씩 그리기로 했고, 겹 전체 조회가 그 재료를 준다.
   * 엔진의 `setCrowd` 는 남겨 뒀다 — 지우는 대신 안 부른다. 사람이 아주 많아져서 뭉치가
   * 다시 필요해지면 그때 여기서 부르면 된다.
   */
  useEffect(() => {
    getMapEngine()?.setCrowd(layer, EMPTY_CROWD);
  }, [layer]);

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
