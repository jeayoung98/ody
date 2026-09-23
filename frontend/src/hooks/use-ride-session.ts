"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, RIDE_ENDED_BY_CAPTAIN, RIDE_ENDED_BY_DISBAND, STORAGE_KEYS } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { rideLayerTarget } from "@/components/map/engine/ride-layer";
import { useRideMutation, type RideTarget } from "@/hooks/mutations/use-ride-mutation";
import { onConnectionChange, onType } from "@/lib/realtime/stomp-client";
import { readStorage } from "@/lib/storage";
import { endRide, playFrom, positionNow, syncPlayback } from "@/lib/realtime/ride";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";
import type {
  PresenceErrorPayload,
  RideEndedPayload,
  RidePanelPayload,
  RidePlaybackPayload,
  RideRiderJoinedPayload,
  RideRiderLeftPayload,
  RideTrackPayload,
} from "@/types";

/**
 * 따라가는 동안 오는 것들을 화면에 옮긴다 (2차 실시간 명세 §4, S15P21A405-530).
 *
 * **항상 듣는다.** 따라가는 중일 때만 구독을 걸면, 탑승 응답과 첫 `RIDE_*` 사이의 틈에서
 * 프레임을 놓친다 — 서버는 탑승 처리 안에서 이미 화면을 한 번 밀어 준다 (§3.1-3).
 * 대신 처리기마다 "지금 따라가는 중인가" 를 먼저 본다.
 */
export function useRideSession(): void {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    /**
     * 인솔자가 곡을 바꿨다. **새 곡은 처음부터 튼다** — 그래서 재생 위치가 실려 오지 않는다.
     * `playable` 이 false 면 소리 없는 곡이라 **자리만 옮기고 틀지 않는다.**
     */
    const stopTrack = onType<RideTrackPayload>(["RIDE_TRACK"], (p) => {
      const ride = useFollowStore.getState();
      if (!ride.leaderEmail) return;

      ride.setLeaderMusicId(p.musicId);
      /**
       * **겹도 같이 따라간다** (S15P21A405-560). 알림이 `layer` 를 주는데 버리고 있었다 —
       * 인솔자가 파고들면 나만 제자리에 남고, 그 겹에 없는 곡을 가리켜 우주선까지 사라졌다.
       * 자리를 옮기기 **전에** 부른다. 겹이 바뀌면 좌표계가 달라지기 때문이다.
       */
      const toLayer = rideLayerTarget(useMapStore.getState().layer, p.layer);
      if (toLayer != null) getMapEngine()?.rideToLayer(toLayer);
      useMapStore.getState().setMyMusicId(p.musicId);
      // 우주선이 이전 곡에서 새 곡으로 날아온다. 재생은 아래에서 따로 건다
      getMapEngine()?.rideTo(p.musicId);
      if (p.playable) playFrom(p.musicId, 0, true);
      else usePlayerStore.getState().pause();
    });

    /**
     * 인솔자가 재생·정지·구간 이동을 했다.
     *
     * **`state` 를 보고 "옮기기만 할지 틀기까지 할지" 를 가른다.** `event` 만 보면 안 된다 —
     * 멈춘 채로 재생바만 옮긴 경우가 `SEEK` + `PAUSED` 로 온다.
     */
    const stopPlayback = onType<RidePlaybackPayload>(["RIDE_PLAYBACK"], (p) => {
      if (!useFollowStore.getState().leaderEmail) return;
      syncPlayback(positionNow(p.positionMs, p.state, p.serverTs), p.state);
    });

    /**
     * 인솔자가 곡 상세를 열거나 닫았다. **내용은 안 온다** — 곡 번호만 받고 각자 조회한다.
     * 그래야 한 명이 조회에 실패해도 그 사람만 빈 화면이고 나머지는 멀쩡하다.
     *
     * `tab` 은 보지 않는다. 우리 곡 상세는 한 장짜리 스크롤이라 탭이 없다 — 명세가 말하는
     * `nearby` 폴백(§FR-035)이 곧 "그냥 그 곡 상세를 연다" 와 같다.
     */
    const stopPanel = onType<RidePanelPayload>(["RIDE_PANEL"], (p) => {
      if (!useFollowStore.getState().leaderEmail) return;
      const panel = usePanelStore.getState();
      // 스토어에도 남긴다 — 겹이 바뀌면 `map-view` 가 이 값으로 따라가기를 다시 건다 (§551)
      useFollowStore.getState().setLeaderViewingMusicId(p.open ? p.musicId : null);
      if (!p.open || p.musicId == null) {
        panel.close();
        return;
      }
      getMapEngine()?.rideViewing(p.musicId);
      useMapStore.getState().selectMusic(p.musicId);
      panel.openSong(p.musicId);
    });

    /**
     * 인솔자가 사라졌다. **하차했을 때와 같은 상태**라 같은 처리를 한다 (§4.3).
     * 듣던 곡은 끊기지 않는다 — 재생 명령은 오지 않는다.
     */
    const stopEnded = onType<RideEndedPayload>(["RIDE_ENDED"], (p) => {
      const who = useFollowStore.getState().leaderNickname ?? p.captainEmail;
      endRide(p);
      // 인솔자가 강제 하차를 눌렀으면(`CAPTAIN_ENDED`) 그 사람은 그대로 있다 — "떠났다" 고 말하면 틀린다 (S15P21A405-606)
      showToast(p.reason === "CAPTAIN_ENDED" ? RIDE_ENDED_BY_DISBAND(who) : RIDE_ENDED_BY_CAPTAIN(who));
      // 주변 사람 패널이 떠 있으면 목록도 다시 받는다 — 탑승 동안 서버가 구독을 끊어 뒀다
      refetchNearbyIfOpen();
    });

    /**
     * 선단 인원이 바뀌었다. **인솔자에게만** 온다 — 구경꾼용 인원수 알림은 설계상 요청자를
     * 빼기 때문에 인솔자 본인에게 가지 않는다.
     *
     * 둘 다 **바뀐 뒤의** 인원을 싣는다. 탑승 쪽(`RIDE_RIDER_JOINED`)이 3차 계약에서 새로
     * 생겼고(S15P21A405-545), 그 전에는 누가 내릴 때까지 숫자를 몰라 아예 숨겨 뒀다.
     */
    const stopRiders = onType<RideRiderJoinedPayload | RideRiderLeftPayload>(["RIDE_RIDER_JOINED", "RIDE_RIDER_LEFT"], (p) => {
      useFollowStore.getState().setFollowerCount(p.riderCount);
    });

    /**
     * `RIDE_NOT_CAPTAIN` 이 왔다는 것은 **잠금이 새고 있다는 뜻이다** (§9.1). 사용자 잘못이
     * 아니라 우리 잘못이라 토스트로 알리지 않고 개발 콘솔에만 남긴다.
     */
    const stopErr = onType<PresenceErrorPayload>(["PRESENCE_ERROR"], (p) => {
      if (p.code !== "RIDE_NOT_CAPTAIN") return;
      if (process.env.NODE_ENV !== "production") console.warn("[ride] 동승 중에 막힌 조작이 나갔다 — UI 잠금이 빠졌다", p);
    });

    return () => {
      stopTrack();
      stopPlayback();
      stopPanel();
      stopEnded();
      stopRiders();
      stopErr();
    };

    function refetchNearbyIfOpen() {
      if (usePanelStore.getState().activePanel !== "friends") return;
      void qc.refetchQueries({ queryKey: QUERY_KEYS.realtime.nearby });
    }
  }, [qc, showToast]);

  /**
   * **소켓이 열리면 다시 탄다** (S15P21A405-615). 서버는 소켓이 새로 열리면 이전 탑승을 지우므로
   * (§8.3) 들고 있던 상태로 그냥 그리면 서버에 없는 선단이 된다 — 그래서 예전에는 끊고 알렸다.
   * 이제는 인솔자를 저장해 두고(`use-follow-store.start`) **새 탑승 요청을 보낸다.** 새로고침도
   * 같은 길이다 — 스토어는 비어 있지만 sessionStorage 에 인솔자가 남는다.
   *
   * 실패(인솔자 없음·자리 없음·연결 문제)는 뮤테이션이 사유를 토스트로 말한다. 여기서는 상태와
   * 저장을 지워 "타고 있는 척" 이 남지 않게만 한다.
   *
   * **인솔자 본인의 새로고침은 못 살린다.** 서버가 선단을 해체해 따라오던 사람 전부에게
   * `RIDE_ENDED` 가 간다 — 백엔드 유예 기간이 필요하다 (BACKEND-NOTES A-72).
   */
  const { mutateAsync: remount } = useRideMutation();
  useEffect(
    () =>
      onConnectionChange((up) => {
        if (!up) return;
        const s = useFollowStore.getState();
        const target: RideTarget | null = s.leaderEmail
          ? { email: s.leaderEmail, nickname: s.leaderNickname, imageUrl: s.leaderImageUrl }
          : readStorage<RideTarget>(STORAGE_KEYS.rideLeader);
        if (!target) return;
        remount(target).catch(() => {
          const map = useMapStore.getState();
          endRide({ musicId: map.myMusicId, layer: map.layer });
        });
      }),
    [remount],
  );
}
