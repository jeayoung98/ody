"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, NO_GENRE_ID, QUERY_KEYS, REALTIME, RIDE_ENDED_BY_DISBAND, RIDE_REJECTED, RIDE_RESUME_FAILED, STORAGE_KEYS } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { rideLayerTarget } from "@/components/map/engine/ride-layer";
import { useRideMutation, type RideTarget } from "@/hooks/mutations/use-ride-mutation";
import { api } from "@/lib/api";
import { musicToMapPoint } from "@/lib/map-point";
import { onConnectionChange, onType } from "@/lib/realtime/stomp-client";
import { readStorage } from "@/lib/storage";
import { correctDrift, endRide, playFrom, positionNow, syncPlayback } from "@/lib/realtime/ride";
import { ensureSongPoint } from "@/lib/realtime/ride-point";
import { cancelResume, resumeRide } from "@/lib/realtime/ride-resume";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";
import type {
  JourneyRoute,
  MapPoint,
  PlaylistDetail,
  PresenceErrorPayload,
  RideEndedPayload,
  RidePanelPayload,
  RidePlaybackPayload,
  RideRiderJoinedPayload,
  RideRiderLeftPayload,
  RideTrackPayload,
  RideViewPayload,
  UserProfile,
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
    let trackSeq = 0;
    const stopTrack = onType<RideTrackPayload>(["RIDE_TRACK"], (p) => {
      if (!useFollowStore.getState().leaderEmail) return;
      /**
       * **받은 순간을 기준으로 삼는다** (S15P21A405-682). 인솔자는 `serverTs` 에 0초부터 틀었다 — 도착 지연과
       * 아래 제목 대기만큼 늦게 트는 것을 `playFrom` 이 메운다. 예전에는 트는 순간 0초부터라 그만큼 뒤처졌다.
       */
      const receivedAt = Date.now();
      const startMs = positionNow(0, "PLAYING", p.serverTs);
      /**
       * **제목을 받은 뒤 넘어간다** (S15P21A405-656). 바로 넘기면 플레이어바가 상세가 올 때까지 "Track 3242" 를
       * 보인다. 상세는 캐시(`staleTime: Infinity`)에 있으면 즉시, 없으면 한 번의 조회다. 상한을 넘기거나 실패하면
       * 제목 없이 진행한다. 기다리는 사이 더 새 곡이 오면 먼저 것은 버린다 — 옛 곡을 뒤늦게 틀면 안 된다.
       */
      const seq = ++trackSeq;
      // 제목과 함께 **좌표도 갖춘다** (S15P21A405-674) — 상주 집합 밖의 곡이면 우주선이 날아갈 자리가 없었다
      const detail = ensureSongPoint(qc, p.musicId);
      const deadline = new Promise<void>((resolve) => setTimeout(resolve, REALTIME.rideTrackTitleWaitMs));
      void Promise.race([detail, deadline]).then(() => {
        if (seq !== trackSeq) return;
        const ride = useFollowStore.getState();
        if (!ride.leaderEmail) return;
        applyTrack(p, startMs, receivedAt);
      });
    });

    function applyTrack(p: RideTrackPayload, startMs: number, receivedAt: number) {
      const ride = useFollowStore.getState();
      ride.setLeaderMusicId(p.musicId);
      ride.setLeaderLayer(p.layer);
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
      if (p.playable) playFrom(p.musicId, startMs, true, receivedAt);
      else usePlayerStore.getState().pause();
    }

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
     * 인솔자가 지도를 보는 모양을 바꿨다 (BACKEND-NOTES §8, S15P21A405-653). **내용은 안 온다** — 번호만 받고
     * 각자 조회한다. 그래야 한 명이 조회에 실패해도 그 사람만 빈 화면이다.
     *
     * 여정·플리는 조회가 비동기라 **그 사이 더 새 화면이 오면 먼저 것은 버린다** (`viewSeq`). 안 그러면 늦게
     * 도착한 옛 여정이 새 플리 별자리를 덮는다. 주변 탐색은 `panelHandled` 로 연다 — 중심곡 상세는 인솔자의
     * `RIDE_PANEL` 이 따로 옮기므로 여기서 또 열면 두 번 열린다.
     */
    let viewSeq = 0;
    const stopView = onType<RideViewPayload>(["RIDE_VIEW"], (p) => {
      if (!useFollowStore.getState().leaderEmail) return;
      const seq = ++viewSeq;
      const map = useMapStore.getState();
      const fresh = () => seq === viewSeq && !!useFollowStore.getState().leaderEmail;
      if (p.kind === "nearby" && p.centerMusicId != null) {
        map.enterNearby(p.centerMusicId, true);
        return;
      }
      if (p.kind === "journey" && p.startMusicId != null && p.endMusicId != null) {
        const start = p.startMusicId;
        const end = p.endMusicId;
        void qc
          .fetchQuery({
            queryKey: QUERY_KEYS.journey.route(start, end),
            queryFn: () => api<JourneyRoute>(`${API_ENDPOINTS.journey.route}?start=${start}&end=${end}`),
            staleTime: 10 * 60 * 1000,
          })
          .then((route) => {
            if (!fresh() || route.stops.length < 2) return;
            // 좌표를 함께 넘긴다 — 경로 곡은 상주 집합 밖일 수 있어 엔진이 모른다 (`journey-panel` 과 같다)
            useMapStore.getState().showConstellation(
              route.stops.map((s) => s.id),
              route.stops.map((s) => ({ musicId: s.id, pc: s.pc, genreId: NO_GENRE_ID, weight: 1, title: s.title, artist: s.artist, youtubeUrl: null, playable: true })),
              { kind: "journey", startMusicId: route.startMusicId, endMusicId: route.endMusicId },
            );
          })
          .catch(() => {
            /* 나만 빈 화면 — 인솔자 쪽 잘못이 아니라 알리지 않는다 */
          });
        return;
      }
      if (p.kind === "playlist" && p.playlistId != null) {
        const playlistId = p.playlistId;
        void qc
          .fetchQuery({ queryKey: QUERY_KEYS.playlist.detail(playlistId), queryFn: () => api<PlaylistDetail>(API_ENDPOINTS.playlist.detail(playlistId)) })
          .then((pl) => {
            if (!fresh() || pl.items.length < 2) return;
            useMapStore.getState().showConstellation(
              pl.items.map((it) => it.musicId),
              pl.items.map((it) => musicToMapPoint(it.music)).filter((pt): pt is MapPoint => pt != null),
              { kind: "playlist", playlistId },
            );
          })
          .catch(() => {
            /* 위와 같다 */
          });
        return;
      }
      // 기본 지도 (또는 재현할 수 없는 값) — 인솔자 화면을 따라 켠 것을 끈다
      if (map.viewMode === "nearby") map.exitNearby();
      else if (map.viewMode === "constellation") map.clearConstellation();
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
    const stopJoined = onType<RideRiderJoinedPayload>(["RIDE_RIDER_JOINED"], (p) => {
      const ride = useFollowStore.getState();
      ride.setFollowerCount(p.riderCount);
      ride.addRider({ email: p.email, nickname: p.nickname, imageUrl: null });
      /**
       * **사진은 알림에 없다** (S15P21A405-676, BACKEND-NOTES A-85) — 사용자 상세로 받아 헬멧에 넣는다.
       * 못 받으면 절차적 아바타로 남는다. 그 사이 내렸으면 `setRiderImage` 가 빈 목록을 그대로 둔다.
       */
      void qc
        .fetchQuery({ queryKey: QUERY_KEYS.user.profile(p.email), queryFn: () => api<UserProfile>(API_ENDPOINTS.user.detail(p.email)), staleTime: 5 * 60 * 1000 })
        .then((u) => useFollowStore.getState().setRiderImage(p.email, u.imageUrl))
        .catch(() => {
          /* 얼굴 없이 간다 */
        });
    });
    const stopLeft = onType<RideRiderLeftPayload>(["RIDE_RIDER_LEFT"], (p) => {
      const ride = useFollowStore.getState();
      ride.setFollowerCount(p.riderCount);
      ride.removeRider(p.email);
    });

    /**
     * `RIDE_NOT_CAPTAIN` 이 왔다는 것은 **잠금이 새고 있다는 뜻이다** (§9.1). 사용자 잘못이
     * 아니라 우리 잘못이라 토스트로 알리지 않고 개발 콘솔에만 남긴다.
     */
    const stopErr = onType<PresenceErrorPayload>(["PRESENCE_ERROR"], (p) => {
      if (p.code !== "RIDE_NOT_CAPTAIN") return;
      if (process.env.NODE_ENV !== "production") console.warn("[ride] 동승 중에 막힌 조작이 나갔다 — UI 잠금이 빠졌다", p);
    });

    /** 어긋남 확인 (S15P21A405-682). 따라가는 중이 아니면 `correctDrift` 가 바로 돌아간다 */
    const driftTimer = setInterval(correctDrift, REALTIME.rideDriftCheckMs);

    return () => {
      clearInterval(driftTimer);
      stopTrack();
      stopPlayback();
      stopPanel();
      stopView();
      stopEnded();
      stopJoined();
      stopLeft();
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
