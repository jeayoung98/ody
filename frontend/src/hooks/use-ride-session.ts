"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, RIDE_ENDED_BY_DISBAND, RIDE_REJECTED, RIDE_RESUME_FAILED, STORAGE_KEYS } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { rideLayerTarget } from "@/components/map/engine/ride-layer";
import { useRideMutation, type RideTarget } from "@/hooks/mutations/use-ride-mutation";
import { onConnectionChange, onType } from "@/lib/realtime/stomp-client";
import { readStorage } from "@/lib/storage";
import { endRide, playFrom, positionNow, syncPlayback } from "@/lib/realtime/ride";
import { cancelResume, resumeRide } from "@/lib/realtime/ride-resume";
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
  /** 다시 잇기용 탑승. 재시도마다 토스트가 나면 안 되므로 `silent` 다 — 사유는 `giveUp` 이 한 번 말한다 */
  const { mutateAsync: remount } = useRideMutation({ silent: true });

  /**
   * 다시 잇기를 다 해 봤다 — **이제야 내린다** (S15P21A405-615). 기다려도 안 바뀌는 사유(자기 자신·
   * 줄줄이·자리 가득)는 그 사유를, 그 밖은 "다시 연결하지 못했다" 를 말한다.
   */
  const giveUp = (target: RideTarget, code: string) => {
    const map = useMapStore.getState();
    endRide({ musicId: map.myMusicId, layer: map.layer });
    const reason = code !== "UNKNOWN" && code in RIDE_REJECTED ? RIDE_REJECTED[code as keyof typeof RIDE_REJECTED] : null;
    showToast(reason ?? RIDE_RESUME_FAILED(target.nickname ?? target.email));
    if (usePanelStore.getState().activePanel === "friends") void qc.refetchQueries({ queryKey: QUERY_KEYS.realtime.nearby });
  };

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
     * 인솔자가 사라졌다 (§4.3).
     *
     * **강제 하차(`CAPTAIN_ENDED`)만 바로 내린다** — 인솔자가 직접 누른 것이다. 그 사람은 그대로
     * 있으니 "떠났다" 고 말하면 틀린다 (S15P21A405-606).
     *
     * **`CAPTAIN_LEFT` 는 바로 내리지 않는다** (S15P21A405-615). 서버는 인솔자 소켓이 끊기면 곧
     * 선단을 해체하는데, 그 대부분은 새로고침·잠깐의 네트워크 끊김이다. 인솔자가 돌아올 창(45초)
     * 동안 같은 인솔자에게 다시 타 본다. 서버는 나를 그 자리에 내려 두지만 우리는 인솔자 표식을
     * 그대로 두고, 끝내 안 되면 그때 내린다. 듣던 곡은 어느 길이든 끊기지 않는다.
     */
    const stopEnded = onType<RideEndedPayload>(["RIDE_ENDED"], (p) => {
      const s = useFollowStore.getState();
      const who = s.leaderNickname ?? p.captainEmail;
      if (p.reason === "CAPTAIN_ENDED" || !s.leaderEmail) {
        endRide(p);
        showToast(RIDE_ENDED_BY_DISBAND(who));
        // 주변 사람 패널이 떠 있으면 목록도 다시 받는다 — 탑승 동안 서버가 구독을 끊어 뒀다
        refetchNearbyIfOpen();
        return;
      }
      const target: RideTarget = { email: s.leaderEmail, nickname: s.leaderNickname, imageUrl: s.leaderImageUrl };
      resumeRide(target, remount, (code) => giveUp(target, code));
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
      cancelResume();
    };

    function refetchNearbyIfOpen() {
      if (usePanelStore.getState().activePanel !== "friends") return;
      void qc.refetchQueries({ queryKey: QUERY_KEYS.realtime.nearby });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- giveUp 은 qc·showToast 만 닫아 두고, 그 둘이 deps 다
  }, [qc, showToast, remount]);

  /**
   * **소켓이 열리면 다시 탄다** (S15P21A405-615). 서버는 소켓이 새로 열리면 이전 탑승을 지우므로
   * (§8.3) 들고 있던 상태로 그냥 그리면 서버에 없는 선단이 된다 — 그래서 예전에는 끊고 알렸다.
   * 이제는 인솔자를 저장해 두고(`use-follow-store.start`) **새 탑승 요청을 보낸다.** 새로고침도
   * 같은 길이다 — 스토어는 비어 있지만 sessionStorage 에 인솔자가 남는다.
   *
   * **바로 내리지 않는다.** 연결이 흔들리는 동안은 `resumeRide` 가 간격을 늘리며 다시 시도하고,
   * 기다려도 안 바뀌는 사유거나 재시도를 다 썼을 때만 `giveUp` 이 내리고 사유를 말한다.
   *
   * **인솔자 본인의 새로고침은 못 살린다.** 서버가 선단을 해체해 따라오던 사람 전부에게
   * `RIDE_ENDED` 가 간다 — 백엔드 유예 기간이 필요하다 (BACKEND-NOTES A-72).
   */
  useEffect(
    () =>
      onConnectionChange((up) => {
        if (!up) return;
        const s = useFollowStore.getState();
        const target: RideTarget | null = s.leaderEmail
          ? { email: s.leaderEmail, nickname: s.leaderNickname, imageUrl: s.leaderImageUrl }
          : readStorage<RideTarget>(STORAGE_KEYS.rideLeader);
        if (!target) return;
        resumeRide(target, remount, (code) => giveUp(target, code));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- giveUp 은 qc·showToast 만 닫아 둔다
    [remount, qc, showToast],
  );
}
