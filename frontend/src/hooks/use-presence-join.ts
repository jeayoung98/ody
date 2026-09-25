"use client";

import { useEffect } from "react";
import { REALTIME, STORAGE_KEYS } from "@/constants";
import { readStorage } from "@/lib/storage";
import { recoveryFor } from "@/lib/realtime/presence-recovery";
import { expect, onConnectionChange, onType, reconnect, send, settle } from "@/lib/realtime/stomp-client";
import { isRiding } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import type { PresenceErrorPayload, PresenceJoined } from "@/types";

/**
 * 내 위치 — join · heartbeat · leave (S15P21A405-482, 실시간 작업명세 §3).
 *
 * **`PRESENCE_NO_ANCHOR` 는 오류가 아니다** (§3.3). 한 번도 곡을 재생한 적 없는 사용자는 join 이
 * 이 코드로 거부되는데, 그때는 지도를 평소대로 두고 내 표식만 없는 상태로 둔다. 첫 재생
 * (`POST /api/music/play`) 응답이 오면 그때 표식이 생긴다 — 표식의 생성 시점이 두 갈래다.
 *
 * **`PRESENCE_STALE` 도 토스트를 띄우지 않는다** (§12.1). 백그라운드에 오래 둔 사용자가 복귀할
 * 때마다 경고가 쌓인다. 조용히 join·viewport 를 다시 보내는 것이 맞는 처리다.
 */

/** join 전용 카운터. 뷰포트 카운터와 **별개**다 (§5.1) */
let joinSeq = 0;
/** 마지막으로 보낸 겹 — 재전송할 때 이 값을 쓴다 */
let lastLayer = 0;

/** 응답 타임아웃을 거는 키 (§12.3) */
const JOIN_KEY = "presence/join";

/**
 * `joinAndWait` 가 기다리는 중인 해제 함수들 (S15P21A405-555).
 *
 * 응답은 한 곳(구독)으로만 오는데 기다리는 쪽은 여럿(따라가기·재생 선언)이라 가운데에 둔다.
 */
const joinWaiters = new Set<() => void>();

function releaseJoinWaiters(): void {
  // 복사해서 돈다 — 각 해제 함수가 자기를 집합에서 뺀다
  for (const done of [...joinWaiters]) done();
}

function anchorMusicId(): number {
  const playing = readStorage<number>(STORAGE_KEYS.playingMusicId);
  return playing ?? useMapStore.getState().myMusicId ?? 1;
}

/**
 * 지금 바로 join 을 보낸다.
 *
 * 훅 밖에서도 부른다 — 재생 직전(`use-record-play-mutation`)에 presence 를 깨우는 용도다.
 * 연결 전이면 `send` 가 false 를 주고 조용히 버려진다. 연결되면 훅이 다시 보낸다.
 */
export function sendJoinNow(layer?: number): void {
  /**
   * **따라가는 동안에는 보내지 않는다** (2차 명세 §6, S15P21A405-530). 서버가
   * `RIDE_NOT_CAPTAIN` 으로 거부하는 경로라, 보내면 오류 큐만 시끄럽고 내 자리는 그대로다.
   * 겹이 바뀌거나 탭이 돌아올 때마다 도는 자리라 여기서 한 번 막으면 전부 막힌다.
   *
   * **하차·강제 종료 직후에는 보내야 한다.** 그 길은 `endRide` 가 탑승 상태를 먼저 지운 뒤
   * 이 함수를 부르므로 이 문을 그냥 지나간다.
   */
  if (isRiding()) return;
  const at = layer ?? useMapStore.getState().layer;
  lastLayer = at;
  joinSeq += 1;
  const ok = send(REALTIME.send.join, { requestSeq: joinSeq, layer: at, musicId: anchorMusicId() });
  // 소켓은 실패해도 조용할 수 있다. 응답도 오류도 없으면 한 번 더 보낸다 (§12.3)
  if (ok) expect(JOIN_KEY, () => sendJoinNow(at));
}

/**
 * join 을 보내고 **응답이 올 때까지 기다린다** (S15P21A405-555).
 *
 * `sendJoinNow` 는 소켓에 던지고 바로 돌아온다. 그 뒤에 REST 를 부르면 서버가 join 을 처리하기
 * 전에 요청이 닿아 `PRESENCE_ERROR` 가 난다 — **따라가기 422 가 이 경합이었다.** 부르는 쪽이
 * REST 전에 이걸 기다리면 그 창이 닫힌다.
 *
 * **실패해도 resolve 한다.** 여기서 던지면 진짜 원인(서버가 준 거부 사유)이 이 기다림에 가린다.
 * 못 들어갔으면 뒤따르는 REST 가 제 오류로 말하게 둔다.
 *
 * presence 가 아예 만료됐으면 오류 핸들러가 소켓을 다시 열고, 그 새 연결의 join 응답이 여기서
 * 기다리는 쪽을 풀어 준다 — 부르는 쪽은 한 번 더 부르기만 하면 된다.
 */
export function joinAndWait(layer?: number): Promise<void> {
  // 따라가는 중이면 sendJoinNow 가 아무것도 안 보낸다 — 기다릴 응답이 없다
  if (isRiding()) return Promise.resolve();
  sendJoinNow(layer);
  return new Promise<void>((resolve) => {
    // `timer` 를 뒤에 두는 것은 의도다 — `done` 은 타이머가 잡힌 뒤에만 불린다
    const done = () => {
      clearTimeout(timer);
      joinWaiters.delete(done);
      resolve();
    };
    const timer = setTimeout(done, REALTIME.requestTimeoutMs);
    joinWaiters.add(done);
  });
}

export function usePresenceJoin(): void {
  const layer = useMapStore((s) => s.layer);

  // 겹이 바뀌면 다시 보낸다. viewport 보다 **먼저** 나가야 내 표식이 이전 겹에 남지 않는다 (§3.2)
  useEffect(() => {
    sendJoinNow(layer);
  }, [layer]);

  // 연결이 열릴 때마다 — 첫 연결도 재연결도 같은 자리다. 서버가 상태를 복원해 주지 않는다 (§12.4)
  useEffect(() => onConnectionChange((up) => up && sendJoinNow(lastLayer)), []);

  useEffect(() => {
    const stop = onType<PresenceJoined>(["PRESENCE_JOINED"], (p) => {
      settle(JOIN_KEY);
      releaseJoinWaiters();
      // **응답의 musicId 가 내 진짜 위치다.** 요청에 넣은 값과 다를 수 있다 (§3.1)
      useMapStore.getState().setMyMusicId(p.musicId);
    });
    const stopErr = onType<PresenceErrorPayload>(["PRESENCE_ERROR"], (p) => {
      settle(JOIN_KEY);
      releaseJoinWaiters();
      // 첫 재생 전이다. 오류가 아니라 정상 흐름이라 표식만 없는 상태로 둔다 (§3.3)
      if (p.code === "PRESENCE_NO_ANCHOR") useMapStore.getState().setMyMusicId(null);
      /**
       * 어떤 복구가 필요한지는 `presence-recovery` 가 정한다 (S15P21A405-555) — 그 표에
       * `PRESENCE_NOT_CONNECTED` 칸이 비어 있어서 만료된 사용자가 새로고침 전까지 지도에서
       * 사라져 있었다. 토스트는 띄우지 않는다. 둘 다 조용히 복구할 수 있는 것들이다 (§12.1·§3.5).
       */
      const recovery = recoveryFor(p.code);
      if (recovery === "reconnect") void reconnect();
      if (recovery === "rejoin") sendJoinNow(lastLayer);
    });
    return () => {
      stop();
      stopErr();
    };
  }, []);

  /**
   * heartbeat. **이 타이머만 믿지 않는다** (§12.1) — 브라우저가 안 보이는 탭의 `setInterval` 을
   * 1분 가까이 늘려서, 15초로 걸어도 실측에서 53~61초 간격으로 나갔다. 아래 `visibilitychange`
   * 가 진짜 복구 지점이다.
   */
  useEffect(() => {
    const id = window.setInterval(() => send(REALTIME.send.heartbeat), REALTIME.heartbeatMs);
    return () => window.clearInterval(id);
  }, []);

  // 탭으로 돌아오면 만료됐다고 **가정하고** 무조건 복구한다. 확인하고 고치는 것보다 싸다 (§12.1)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      /**
       * **heartbeat 를 먼저 보낸다** (S15P21A405-555). 아직 만료 전이면 이 한 방으로 끝난다 —
       * 늘어진 타이머가 다음에 돌 때까지 최대 1분을 사라진 채로 있지 않는다. 이미 만료됐으면
       * 서버가 `PRESENCE_STALE` 을 주고, 그 뒤 join 이 `PRESENCE_NOT_CONNECTED` 로 답해
       * 소켓 재연결까지 이어진다.
       */
      send(REALTIME.send.heartbeat);
      sendJoinNow(lastLayer);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /**
   * 탭이 닫힐 때 알린다 (§3.4). 연결이 끊기면 서버가 알아서 정리하므로 선택이지만, 보내면
   * 남들 화면에서 즉시 사라진다. **보낸 뒤 heartbeat 를 멈추지 않으면** 15초마다
   * `PRESENCE_STALE` 이 쌓인다 — `pagehide` 는 곧 언마운트라 위 타이머도 같이 걷힌다.
   */
  useEffect(() => {
    const onHide = () => send(REALTIME.send.leave);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);
}
