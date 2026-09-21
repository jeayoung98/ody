"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, REALTIME } from "@/constants";
import { onConnectionChange, onType, send } from "@/lib/realtime/stomp-client";
import type { NearbyChange, NearbyPerson, NearbySnapshot } from "@/types";

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
          const next = [...people];
          next[at] = { ...next[at], musicId: p.musicId!, nickname: p.nickname, imageUrl: p.imageUrl, meetingCount: p.meetingCount ?? next[at].meetingCount };
          return next;
        }
        /**
         * **`distance` 가 오지 않는다** (§6.2). 정렬 근거가 없으니 자리를 추측해야 한다 —
         * 이미 목록에 있는 곡이면 그 곡 옆이 맞고(같은 곡이니 거리도 같다), 아니면 맨 뒤다.
         */
        const fresh: NearbyPerson = {
          email: p.email,
          nickname: p.nickname,
          imageUrl: p.imageUrl,
          meetingCount: p.meetingCount ?? 0,
          riderCount: p.riderCount ?? 0,
          musicId: p.musicId!,
          title: "",
          artist: null,
          distance: Number.POSITIVE_INFINITY,
        };
        const sameSong = people.findIndex((x) => x.musicId === p.musicId);
        if (sameSong < 0) return [...people, fresh];
        const next = [...people];
        next.splice(sameSong + 1, 0, { ...fresh, title: next[sameSong].title, artist: next[sameSong].artist, distance: next[sameSong].distance });
        return next;
      });
    });

    return () => {
      stopSnap();
      stopDelta();
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
      send(REALTIME.send.nearbyClose);
    };
  }, [open]);
}
