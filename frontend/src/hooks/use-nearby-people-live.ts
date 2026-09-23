"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, REALTIME } from "@/constants";
import { onConnectionChange, onType, send } from "@/lib/realtime/stomp-client";
import { isRiding } from "@/stores/use-follow-store";
import type { NearbyBulkEnter, NearbyChange, NearbyPerson, NearbyRiderCount, NearbySnapshot } from "@/types";

/**
 * 주변 사람 목록을 소켓 델타로 갱신한다 (S15P21A405-482, 실시간 작업명세 §6.2).
 *
 * **`snapshotSeq` 이하는 버린다.** 목록을 받은 시점에 서버가 이미 반영한 순번이라, 그 이하의
 * 델타는 이미 목록에 들어 있다. 그리고 그 값은 **연결 단위**다 — 재연결하면 서버 카운터가
 * 0 부터 다시 매겨지므로 목록도 다시 받아야 한다 (§12.2·§12.4).
 */
export function useNearbyPeopleLive(open: boolean, refetch: () => void): void {
  const qc = useQueryClient();
  /** 이 목록이 이미 반영한 마지막 순번. 스냅샷을 받을 때마다 갱신된다 */
  const snapshotSeq = useRef(0);

  useEffect(() => {
    if (!open) return;

    const put = (fn: (people: NearbyPerson[]) => NearbyPerson[]) =>
      qc.setQueryData<NearbySnapshot>(QUERY_KEYS.realtime.nearby, (prev) => (prev ? { ...prev, people: fn(prev.people) } : prev));

    const stopSnap = onType<NearbySnapshot>(["NEARBY_SNAPSHOT"], (p) => {
      // 내 곡이 바뀌어 기준이 달라졌다 — 목록을 통째로 교체한다
      snapshotSeq.current = p.snapshotSeq;
      qc.setQueryData<NearbySnapshot>(QUERY_KEYS.realtime.nearby, p);
    });

    const stopDelta = onType<NearbyChange>(["NEARBY_ENTER", "NEARBY_MOVE", "NEARBY_LEAVE"], (p, msg) => {
      if (msg.seq > 0 && msg.seq <= snapshotSeq.current) return;
      if (msg.type === "NEARBY_LEAVE") {
        put((people) => people.filter((x) => x.email !== p.email));
        return;
      }
      if (p.musicId == null) return;
      put((people) => {
        const at = people.findIndex((x) => x.email === p.email);
        if (at >= 0) {
          // 자리를 옮겼다. 좌표를 갈아 끼우면 거리와 순서는 `use-nearby-list` 가 다시 잰다
          const next = [...people];
          next[at] = { ...next[at], musicId: p.musicId!, nickname: p.nickname, imageUrl: p.imageUrl, meetingCount: p.meetingCount ?? next[at].meetingCount, x: p.x, y: p.y };
          return next;
        }
        /**
         * **`distance` 가 오지 않는다** (5차 명세 §2) — 받는 사람마다 다른 값이라 서버가
         * 안 준다. 대신 **좌표가 온다.** 예전에는 거리를 몰라 "같은 곡을 듣는 사람 옆" 으로
         * 자리를 추측하고 그런 이웃이 없으면 맨 뒤로 보냈는데, 이제 추측할 이유가 없다 —
         * 거리는 `use-nearby-list` 가 좌표로 잰다. 여기서는 목록에 넣기만 한다.
         */
        const fresh: NearbyPerson = {
          email: p.email,
          nickname: p.nickname,
          imageUrl: p.imageUrl,
          meetingCount: p.meetingCount ?? 0,
          riderCount: p.riderCount ?? 0,
          musicId: p.musicId!,
          x: p.x,
          y: p.y,
          distance: Number.POSITIVE_INFINITY,
        };
        return [...people, fresh];
      });
    });

    /**
     * 선단이 흩어져 여럿이 한꺼번에 들어왔다 (2차 명세 §7.2, S15P21A405-530).
     * **한 덩어리로 받았으니 한 번만 다시 그린다** — 한 명씩 넣으면 이 메시지의 의미가 없다.
     *
     * 사람마다 좌표가 실리지 않는다. 자리는 `musicId` 하나로 전원이 같아서, 좌표를 비워 두면
     * `use-nearby-list` 가 그 곡으로 지도에서 찾아본다.
     */
    const stopBulk = onType<NearbyBulkEnter>(["NEARBY_BULK_ENTER"], (p) => {
      put((people) => {
        const next = people.filter((x) => !p.people.some((n) => n.email === x.email));
        // 같은 곡에 이미 아는 사람이 있으면 그 자리를 빌린다. 없으면 곡으로 찾게 비워 둔다
        const near = next.find((x) => x.musicId === p.musicId) ?? null;
        const fresh = p.people.map((n) => ({
          email: n.email,
          nickname: n.nickname,
          imageUrl: n.imageUrl,
          meetingCount: n.meetingCount ?? 0,
          riderCount: n.riderCount ?? 0,
          musicId: p.musicId,
          x: near?.x ?? null,
          y: near?.y ?? null,
          distance: Number.POSITIVE_INFINITY,
        }));
        return [...next, ...fresh];
      });
    });

    /** 인원수만 바뀌었다 (§7.1). 자리는 그대로 두고 숫자만 갈아 끼운다 */
    const stopRiders = onType<NearbyRiderCount>(["NEARBY_RIDER_COUNT"], (p) => {
      put((people) => {
        const at = people.findIndex((x) => x.email === p.email);
        if (at < 0 || people[at].riderCount === p.riderCount) return people;
        const next = [...people];
        next[at] = { ...next[at], riderCount: p.riderCount };
        return next;
      });
    });

    return () => {
      stopSnap();
      stopDelta();
      stopBulk();
      stopRiders();
    };
  }, [open, qc]);

  /**
   * 재연결하면 이 구독도 없다 (§12.4). **REST 지만 구독 등록을 겸하므로** 다시 부르지 않으면
   * 패널은 떠 있는데 `NEARBY_*` 가 영영 안 온다.
   */
  useEffect(() => {
    if (!open) return;
    return onConnectionChange((up) => {
      if (!up) return;
      snapshotSeq.current = 0;
      refetch();
    });
  }, [open, refetch]);

  // 패널을 닫을 때 알린다. 안 보내면 델타가 계속 온다 (§6.3)
  useEffect(() => {
    if (!open) return;
    return () => {
      // 따라가는 중이면 이 경로도 막혀 있다 (2차 명세 §6). 서버가 이미 내 구독을 끊어 뒀다
      if (isRiding()) return;
      send(REALTIME.send.nearbyClose);
    };
  }, [open]);
}
