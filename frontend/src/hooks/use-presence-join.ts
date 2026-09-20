"use client";

import { useEffect } from "react";
import { REALTIME, STORAGE_KEYS } from "@/constants";
import { readStorage } from "@/lib/storage";
import { expect, onConnectionChange, onType, send, settle } from "@/lib/realtime/stomp-client";
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
  const at = layer ?? useMapStore.getState().layer;
  lastLayer = at;
  joinSeq += 1;
  const ok = send(REALTIME.send.join, { requestSeq: joinSeq, layer: at, musicId: anchorMusicId() });
  // 소켓은 실패해도 조용할 수 있다. 응답도 오류도 없으면 한 번 더 보낸다 (§12.3)
  if (ok) expect(JOIN_KEY, () => sendJoinNow(at));
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
      // **응답의 musicId 가 내 진짜 위치다.** 요청에 넣은 값과 다를 수 있다 (§3.1)
      useMapStore.getState().setMyMusicId(p.musicId);
    });
    const stopErr = onType<PresenceErrorPayload>(["PRESENCE_ERROR"], (p) => {
      settle(JOIN_KEY);
      // 첫 재생 전이다. 오류가 아니라 정상 흐름이라 표식만 없는 상태로 둔다 (§3.3)
      if (p.code === "PRESENCE_NO_ANCHOR") useMapStore.getState().setMyMusicId(null);
      // 만료됐거나 다른 탭이 조종 중이다. 조용히 복구만 한다 (§12.1·§3.5)
      if (p.code === "PRESENCE_STALE") sendJoinNow(lastLayer);
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
      if (document.visibilityState === "visible") sendJoinNow(lastLayer);
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
