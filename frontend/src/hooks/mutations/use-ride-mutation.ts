import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, BOTS, CHANGED, RIDE_CAPTAIN_UNREACHABLE, RIDE_REJECTED } from "@/constants";
import { api, ApiError } from "@/lib/api";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { rideLayerTarget } from "@/components/map/engine/ride-layer";
import { isAudible, markDead, pickSong } from "@/lib/bots/pick-song";
import { dropSong, setSong } from "@/lib/bots/sim";
import { isBot } from "@/lib/bots/roster";
import { botLiveOf, useBotStore } from "@/stores/use-bot-store";
import { joinAndWait } from "@/hooks/use-presence-join";
import { endRide, playFrom } from "@/lib/realtime/ride";
import { canRideOptimistically } from "@/lib/realtime/ride-optimistic";
import { isConnected } from "@/lib/realtime/stomp-client";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { RideResponse } from "@/types";

/** 누구를 따라갈지와, 화면에 띄울 그 사람의 표시 정보 */
export interface RideTarget {
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  /**
   * 그 사람이 서 있는 곡 — **부르는 쪽이 아는 만큼만** (S15P21A405-642).
   *
   * 낙관적 진입이 표식을 미리 옮기는 데 쓴다. 주변 사람 목록은 이 값을 알고(`NearbyPerson.musicId`)
   * 프로필 화면은 지금 듣는 곡으로 안다. 모르면 비워 두면 되고, 그때는 자리를 안 옮기고
   * 따라가기 상태만 먼저 세운다. **진짜 자리는 어차피 응답이 정한다.**
   */
  musicId?: number | null;
}

/**
 * 따라가기 시작 — `POST /api/realtime/ride` (2차 실시간 명세 §3.1, S15P21A405-530).
 *
 * **소켓이 아니라 REST 다.** 거부 사유가 사용자에게 보여야 하는 경로라서다 — 소켓으로 보내면
 * 막혔을 때 아무 응답이 없어 버튼만 안 먹는 것처럼 보인다.
 *
 * **422 는 presence 만료일 때가 많다** (1차 §12.1). 재생 선언과 같은 처리를 한다 — 부르기 전에
 * join 을 보내 **응답까지 기다리고**, 그래도 422 면 한 번 더 기다린 뒤 **한 번만** 재시도한다.
 */
/** `silent` 면 거부 토스트를 띄우지 않는다 — 다시 잇기(`ride-resume`)가 재시도마다 토스트를 내지 않으려고 쓴다 */
export function useRideMutation({ silent = false }: { silent?: boolean } = {}) {
  const showToast = useToastStore((s) => s.show);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (target: RideTarget): Promise<RideResponse> => {
      // 봇은 서버에 없는 사람이다. 보내 봐야 404 고, 보내면 안 되는 요청이다 (S15P21A405-536)
      if (isBot(target.email)) return mountBot(target.email, qc);
      /**
       * presence 가 살아 있어야 200 이 온다. **응답을 기다린다** (S15P21A405-555) — 예전에는
       * 던지고 바로 REST 를 불러서, 서버가 join 을 처리하기 전에 요청이 닿으면 그대로 422 였다.
       */
      await joinAndWait();
      try {
        return await mount(target.email);
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "PRESENCE_ERROR") throw e;
        /**
         * 자동 복구는 한 번뿐이다. 반복하면 사용자는 아무것도 모른 채 기다리기만 한다.
         *
         * presence 가 만료됐던 경우 첫 join 은 `PRESENCE_NOT_CONNECTED` 로 튕기고 오류 핸들러가
         * 소켓을 다시 연다. 이 두 번째 기다림이 그 새 연결의 join 응답을 받아 낸다.
         */
        await joinAndWait();
        return await mount(target.email);
      }
    },

    /**
     * **누르는 즉시 따라가는 화면이 된다** (S15P21A405-642).
     *
     * 여기까지 오는 길은 왕복 두 번이다 — `joinAndWait` 로 presence 를 확인하고, 그 다음
     * `POST /api/realtime/ride`. 느린 망에서는 그 사이 화면에 아무 일도 안 일어나서 **버튼만
     * 먹은 것처럼** 보였다.
     *
     * 먼저 세우는 것은 **화면뿐이다.** 재생은 건드리지 않는다 — 인솔자가 듣던 지점(`positionMs`)은
     * 응답에만 있고, 0초부터 틀어 두면 답이 온 순간 소리가 튄다. 소리는 `onSuccess` 가 맞춘다.
     *
     * 거절되면 {@link endRide} 가 누르기 전 자리로 되돌린다. `silent`(다시 잇기)는 건너뛴다 —
     * 그건 복구 경로라 확정 전에 화면을 세울 이유가 없다.
     */
    onMutate: (target) => {
      const ok = canRideOptimistically({ ridingEmail: useFollowStore.getState().leaderEmail, targetEmail: target.email, silent });
      if (!ok) return undefined;
      const map = useMapStore.getState();
      const before = { musicId: map.myMusicId, layer: map.layer };
      useFollowStore.getState().start({
        email: target.email,
        nickname: target.nickname,
        imageUrl: target.imageUrl,
        // 모르면 내 자리에 세워 둔다. 응답이 오면 진짜 자리로 옮겨진다
        musicId: target.musicId ?? map.myMusicId ?? -1,
        snapshotSeq: 0,
      });
      if (target.musicId != null) {
        map.setMyMusicId(target.musicId);
        getMapEngine()?.rideTo(target.musicId);
      }
      return before;
    },

    onSuccess: (r, target) => {
      /**
       * **타면 내 별자리는 무조건 사라진다** (ACT-01, S15P21A405-621).
       *
       * 지우는 일 자체는 원래도 일어났다 — 아래 `playFrom` 이 인솔자 곡을 `playSingle` 로 트는데,
       * 거기 "별자리에 없는 곡을 틀면 별자리를 지운다" 가 들어 있다. 문제는 그 조건이
       * **인솔자 곡이 내 목록에 없을 때**만 맞는다는 것이다. 인솔자가 마침 내 여정·플리 안의
       * 곡을 듣고 있으면 조건에 안 걸려서 별자리가 그대로 남았다.
       *
       * 타는 동안 보는 것은 내 목록이 아니라 **인솔자가 가는 길**이다. 우연히 겹친 한 곡 때문에
       * 남의 여정을 따라가면서 내 별자리를 보고 있게 두지 않는다.
       *
       * 여기 두는 이유는 **탑승이 시작되는 자리가 여기 하나**여서다 — 보통 탑승도, 봇 탑승도,
       * 새로고침 뒤 재탑승(S15P21A405-615)도 전부 이 뮤테이션을 지난다.
       *
       * 여정 경로 자체(`useJourneyStore`)는 안 지운다. 하차하면 돌아갈 자리가 있어야 한다.
       */
      useMapStore.getState().clearConstellation();
      useFollowStore.getState().start({
        email: r.captainEmail,
        nickname: target.nickname,
        imageUrl: target.imageUrl,
        musicId: r.musicId,
        snapshotSeq: r.snapshotSeq,
      });
      useFollowStore.getState().setLeaderViewingMusicId(r.panel.open ? r.panel.musicId : null);
      // 인솔자가 다른 겹에 있으면 거기부터 간다 (S15P21A405-560)
      const toLayer = rideLayerTarget(useMapStore.getState().layer, r.layer);
      if (toLayer != null) getMapEngine()?.rideToLayer(toLayer, r.musicId);
      // 내 자리는 인솔자와 같다. 지도 표식이 그리로 간다
      useMapStore.getState().setMyMusicId(r.musicId);
      // 인솔자가 듣던 지점부터. `PAUSED` 면 그 지점에서 멈춰 선다
      playFrom(r.musicId, r.positionMs, r.playback === "PLAYING");
      /**
       * **타는 순간 곡 상세가 뜬다** (S15P21A405-658). 인솔자가 열어 둔 상세가 있으면 그 곡(§3.1, 중간에 타도
       * 같은 화면), 없으면 인솔자가 듣는 곡이다. 예전에는 앞엣것만 열어서, 프로필에서 따라가기를 누르면 곡은
       * 틀리는데 프로필 패널이 그대로 남아 닫아야 곡 상세가 보였다.
       *
       * 조용한 재탑승(`silent` — 새로고침·재연결)은 예전대로 인솔자 상세가 있을 때만 연다. 보고 있던 화면을
       * 재시도 때마다 곡 상세로 덮으면 안 된다.
       */
      const leaderPanel = r.panel.open && r.panel.musicId != null ? r.panel.musicId : null;
      const songToOpen = leaderPanel ?? (silent ? null : r.musicId);
      if (songToOpen != null) usePanelStore.getState().openSong(songToOpen);
      // 탔다는 한 줄 (S15P21A405-667). 조용한 재탑승은 말하지 않는다 — 재시도마다 뜨면 시끄럽다
      if (!silent) showToast(CHANGED.rideStarted(target.nickname ?? target.email));
      /**
       * 지도는 곧 도착하는 `RIDE_VIEWPORT` 가 그린다 (§3.1-3). 내 뷰포트·주변 사람 구독은
       * **서버가 끊는다** — 프론트가 close 를 보낼 필요가 없고, 보내면 막힌다 (§6).
       */
    },

    onError: (e, _target, before) => {
      // 낙관적으로 세워 둔 화면을 누르기 전으로 되돌린다 (S15P21A405-642)
      if (before) endRide(before);
      if (silent) return;
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
      /**
       * **422 는 두 가지를 한 코드로 말한다** (S15P21A405-628). 내 presence 가 없거나,
       * 상대가 탈 수 있는 상태가 아니거나. 앞엣것은 여기서 직접 확인할 수 있다 —
       * 소켓이 붙어 있으면 내 presence 는 있는 것이므로 남은 건 상대·서버 쪽이다.
       *
       * 구분 없이 "연결이 불안정해요" 만 띄우면 **서버가 거절한 것도 내 인터넷 탓으로
       * 읽힌다.** 폰에서는 콘솔을 못 보므로 이 문구가 유일한 단서다.
       */
      if (code === "PRESENCE_ERROR" && isConnected()) {
        showToast(RIDE_CAPTAIN_UNREACHABLE);
        return;
      }
      showToast(RIDE_REJECTED[code as keyof typeof RIDE_REJECTED] ?? RIDE_REJECTED.UNKNOWN);
    },
  });
}

/**
 * 봇에 타는 길 (S15P21A405-536).
 *
 * **서버 응답과 같은 모양을 만들어 돌려준다.** `onSuccess` 가 그 값 하나만 보고 화면을 세우게
 * 두려는 것이다 — 여기서 스토어를 직접 건드리면 실사용자 경로와 봇 경로가 따로 놀게 되고,
 * 둘 중 하나만 고쳐지는 사고가 난다. 이후 봇이 곡을 옮기는 것은 `use-bots` 가 옮겨 준다
 * (실사용자의 `RIDE_TRACK` 자리).
 *
 * **소리가 나는 곡을 찾을 때까지 넘긴다** (S15P21A405-549). 누른 첫 곡이 조용하면 "따라가기를
 * 눌렀더니 자동으로 플레이" 가 아니다. `use-bots` 가 곡이 바뀔 때마다 하는 확인과 같은 것을
 * 여기서 한 번 미리 한다 — 거기에만 두면 첫 곡은 늘 확인 없이 지나간다.
 */
async function mountBot(captainEmail: string, qc: QueryClient): Promise<RideResponse> {
  const bot = botLiveOf(captainEmail);
  const musicId = bot?.episode.online ? await audibleSongOf(captainEmail, bot.episode.musicId, bot.episode.layer, qc) : null;
  // 자리를 모르는 봇에는 탈 수 없다 — 다른 겹에 있거나 막 자리를 비운 경우다
  if (!bot || !bot.episode.online || musicId == null) throw new ApiError(409, "RIDE_CAPTAIN_INACTIVE", "지금은 따라갈 수 없어요.");

  const layer = bot.episode.layer;
  const at = getMapEngine()?.pointOf(musicId);
  // 넘겨서 다른 곡을 찾았으면 그 곡을 보고 있는 것으로 친다 — 안 그러면 엉뚱한 상세가 열린다
  const viewing = bot.episode.viewingMusicId != null ? musicId : null;
  return {
    captainEmail,
    // 봇 탑승은 서버에 기록이 없다. 종료 보고도 없으므로 이 값은 쓰이지 않는다
    playHistoryId: -1,
    musicId,
    layer,
    x: at?.pc[layer * 2] ?? 0,
    y: at?.pc[layer * 2 + 1] ?? 0,
    cellX: 0,
    cellY: 0,
    playback: "PLAYING",
    positionMs: 0,
    snapshotSeq: 0,
    /**
     * **탑승하자마자 그 곡 상세를 연다** (S15P21A405-551). 실사용자 탑승은 인솔자가 열어 둔
     * 상세를 응답에 실어 주는데(2차 명세 §3.1), 봇에는 그걸 채워 주는 서버가 없어 비어 있었다.
     * 봇이 상세를 안 열어 둔 상태면 여기도 닫힌 채로 둔다 — 그 구분이 있어야 사람으로 보인다.
     */
    panel: { open: viewing != null, musicId: viewing, tab: "info" },
  };
}

/**
 * 이 곡이 소리가 나면 그대로, 아니면 **봇을 다음 곡으로 넘겨** 가며 찾는다.
 *
 * 넘길 때마다 `videoId` 조회가 한 번 나가고 그 조회는 백엔드에서 외부 API 를 탄다.
 * 그 겹 전체가 아직 안 찾아본 곡일 수 있으므로 `BOTS.audibleTries` 에서 멎고 `null` 을 준다 —
 * 그때는 탑승이 "지금은 따라갈 수 없어요" 로 거절된다. 조용한 우주선에 태우는 것보다 낫다.
 */
async function audibleSongOf(email: string, first: number | null, layer: number, qc: QueryClient): Promise<number | null> {
  let musicId = first;
  const map = useMapStore.getState();
  for (let i = 0; i < BOTS.audibleTries; i++) {
    if (musicId != null && (await isAudible(qc, musicId))) {
      // 넘겨서 찾은 곡이면 봇도 그 곡을 듣고 있어야 한다 — 안 그러면 다음 tick 이 또 옮긴다
      if (musicId !== first) useBotStore.getState().setBots(setSong(useBotStore.getState().bots, email, musicId));
      return musicId;
    }
    if (musicId != null) {
      markDead(musicId);
      useBotStore.getState().setBots(dropSong(useBotStore.getState().bots, musicId));
    }
    musicId = pickSong(layer, map.layer, map.myMusicId);
    if (musicId == null) return null;
  }
  return null;
}

const mount = (captainEmail: string) =>
  api<RideResponse>(API_ENDPOINTS.realtime.ride, { method: "POST", body: JSON.stringify({ captainEmail }) });
