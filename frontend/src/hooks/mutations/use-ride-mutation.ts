import { useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS, RIDE_REJECTED } from "@/constants";
import { api, ApiError } from "@/lib/api";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { isBot } from "@/lib/bots/roster";
import { botLiveOf } from "@/stores/use-bot-store";
import { sendJoinNow } from "@/hooks/use-presence-join";
import { playFrom } from "@/lib/realtime/ride";
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
}

/**
 * 따라가기 시작 — `POST /api/realtime/ride` (2차 실시간 명세 §3.1, S15P21A405-530).
 *
 * **소켓이 아니라 REST 다.** 거부 사유가 사용자에게 보여야 하는 경로라서다 — 소켓으로 보내면
 * 막혔을 때 아무 응답이 없어 버튼만 안 먹는 것처럼 보인다.
 *
 * **422 는 presence 만료일 때가 많다** (1차 §12.1). 재생 선언과 같은 처리를 한다 — 부르기 전에
 * join 을 한 번 보내고, 그래도 422 면 join 재전송 뒤 **한 번만** 재시도한다.
 */
export function useRideMutation() {
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async (target: RideTarget): Promise<RideResponse> => {
      // 봇은 서버에 없는 사람이다. 보내 봐야 404 고, 보내면 안 되는 요청이다 (S15P21A405-536)
      if (isBot(target.email)) return mountBot(target.email);
      // presence 가 살아 있어야 200 이 온다. 만료 상태에서 누르면 422 라 미리 깨워 둔다
      sendJoinNow();
      try {
        return await mount(target.email);
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "PRESENCE_ERROR") throw e;
        // 자동 복구는 한 번뿐이다. 반복하면 사용자는 아무것도 모른 채 기다리기만 한다
        sendJoinNow();
        return await mount(target.email);
      }
    },

    onSuccess: (r, target) => {
      useFollowStore.getState().start({
        email: r.captainEmail,
        nickname: target.nickname,
        imageUrl: target.imageUrl,
        musicId: r.musicId,
        snapshotSeq: r.snapshotSeq,
        playHistoryId: r.playHistoryId,
      });
      // 내 자리는 인솔자와 같다. 지도 표식이 그리로 간다
      useMapStore.getState().setMyMusicId(r.musicId);
      // 인솔자가 듣던 지점부터. `PAUSED` 면 그 지점에서 멈춰 선다
      playFrom(r.musicId, r.positionMs, r.playback === "PLAYING");
      // 중간에 타도 같은 화면이 되게 인솔자가 열어 둔 상세를 같이 연다 (§3.1)
      if (r.panel.open && r.panel.musicId != null) usePanelStore.getState().openSong(r.panel.musicId);
      /**
       * 지도는 곧 도착하는 `RIDE_VIEWPORT` 가 그린다 (§3.1-3). 내 뷰포트·주변 사람 구독은
       * **서버가 끊는다** — 프론트가 close 를 보낼 필요가 없고, 보내면 막힌다 (§6).
       */
    },

    onError: (e) => {
      const code = e instanceof ApiError ? e.code : "UNKNOWN";
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
 */
function mountBot(captainEmail: string): RideResponse {
  const bot = botLiveOf(captainEmail);
  const musicId = bot?.episode.musicId;
  // 자리를 모르는 봇에는 탈 수 없다 — 다른 겹에 있거나 막 자리를 비운 경우다
  if (!bot || !bot.episode.online || musicId == null) throw new ApiError(409, "RIDE_CAPTAIN_INACTIVE", "지금은 따라갈 수 없어요.");

  const layer = bot.episode.layer;
  const at = getMapEngine()?.pointOf(musicId);
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
    panel: { open: false, musicId: null, tab: "info" },
  };
}

const mount = (captainEmail: string) =>
  api<RideResponse>(API_ENDPOINTS.realtime.ride, { method: "POST", body: JSON.stringify({ captainEmail }) });
