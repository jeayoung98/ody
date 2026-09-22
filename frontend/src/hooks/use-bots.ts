"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BOTS, RIDE_ENDED_BY_CAPTAIN } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { rideLayerTarget } from "@/components/map/engine/ride-layer";
import { isAudible, markDead, pickSong } from "@/lib/bots/pick-song";
import { BOT_ROSTER } from "@/lib/bots/roster";
import { browsesAway, dropSong, nextEpisode, opensDetail, rnd, type BotEpisode } from "@/lib/bots/sim";
import { subscribePlayback } from "@/lib/playback-events";
import { endRide, playFrom } from "@/lib/realtime/ride";
import { useBotStore, type BotLive } from "@/stores/use-bot-store";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useToastStore } from "@/stores/use-toast-store";

/**
 * 봇을 굴리는 유일한 시계 (S15P21A405-536).
 *
 * **지도 화면에서 한 번만 돈다.** 두 군데서 돌리면 같은 봇이 화면마다 다른 곡을 듣게 된다 —
 * 그래서 결과는 스토어에 놓고(`use-bot-store`), 읽는 쪽은 스토어만 본다.
 *
 * 하는 일은 셋뿐이다. 끝난 에피소드를 다음 것으로 넘기고, 곡이 빈 봇에게 곡을 붙이고,
 * **내가 따라가는 봇이면 그 변화를 내 화면에도 옮긴다.** 마지막 것이 `RIDE_TRACK` 처리기가
 * 하는 일과 같은데, 봇에게는 소켓이 오지 않으므로 여기가 그 자리를 대신한다.
 */
export function useBots(enabled: boolean): void {
  const setBots = useBotStore((s) => s.setBots);
  const showToast = useToastStore((s) => s.show);
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const now = Date.now();
      const map = useMapStore.getState();
      const prev = useBotStore.getState().bots;
      const before = new Map(prev.map((b) => [b.email, b.episode]));

      const next: BotLive[] = BOT_ROSTER.map((seedInfo) => {
        const was = before.get(seedInfo.email) ?? null;
        let episode = was == null || now >= was.endsAt ? nextEpisode(seedInfo.seed, was, now, map.layer) : was;

        /**
         * **처음 등장할 때는 에피소드 중간부터 시작한다.** 안 그러면 여섯 명이 같은 순간에
         * 곡을 갈아타 한꺼번에 움직이는 것이 눈에 띈다 — 사람이 아니라 태엽으로 보인다.
         */
        if (was == null) {
          const into = Math.round(rnd(seedInfo.seed, 0, 7) * (episode.endsAt - episode.startedAt));
          episode = { ...episode, startedAt: episode.startedAt - into, endsAt: episode.endsAt - into };
        }

        // 겹이 나와 맞는 순간에 곡이 붙는다 — 다른 겹은 엔진이 상주 집합을 안 들고 있어 고를 수 없다
        if (episode.online && episode.musicId == null) {
          const picked = pickSong(episode.layer, map.layer, map.myMusicId);
          // 새 곡을 틀면 상세는 그 곡으로 (열어 둘 때만). 사람도 틀면서 상세를 같이 여는 일이 많다
          if (picked != null) {
            episode = { ...episode, musicId: picked, viewingMusicId: opensDetail(seedInfo.seed, episode.index) ? picked : null };
          }
        }

        /**
         * **틀고 있는 곡은 그대로 두고 옆 곡을 눌러 보는** 경우 (S15P21A405-551).
         * 실사용자의 `RIDE_PANEL` 에 해당한다 — 재생은 안 건드리고 우측 패널만 바뀐다.
         */
        if (episode.online && episode.musicId != null && browsesAway(seedInfo.seed, episode.index, now / 1000)) {
          const looked = pickSong(episode.layer, map.layer, episode.musicId);
          if (looked != null) episode = { ...episode, viewingMusicId: looked };
        }

        return { ...seedInfo, episode };
      });

      setBots(next);
      const moved = syncRide(before, next, showToast);
      if (moved != null) void ensureAudible(moved);
    };

    /**
     * **소리가 나는 곡에만 세운다** (S15P21A405-549).
     *
     * `playable` 은 유튜브 검색어를 만들 수 있다는 뜻일 뿐이고, 실제로 틀리는지는 `videoId`
     * 조회가 말한다. 봇이 고른 곡은 대부분 아직 안 찾아본 곡(`unsearched`)이라 그대로 두면
     * **소리도 안 나고 넘어가지도 않는다** — 자동 스킵은 "찾아봤는데 없다" 일 때만 돈다.
     *
     * 안 되면 그 곡을 버리고 `tick` 이 새 곡을 붙인다. 그 곡도 안 되면 또 넘기는데,
     * 조회가 외부 API 를 타므로 `BOTS.audibleTries` 에서 멎는다.
     */
    let tries = 0;
    const ensureAudible = async (musicId: number) => {
      if (await isAudible(qc, musicId)) {
        tries = 0;
        return;
      }
      if (++tries > BOTS.audibleTries) return;
      const bots = useBotStore.getState().bots;
      if (!bots.some((b) => b.episode.musicId === musicId)) return;
      useBotStore.getState().setBots(dropSong(bots, musicId));
      tick();
    };

    /**
     * **재생이 안 되는 곡은 그 자리에서 넘긴다** (S15P21A405-546).
     *
     * `pickSong` 이 `playable` 을 거르지만 그건 "유튜브 검색어를 만들 수 있다" 는 뜻일 뿐이라,
     * 검색 결과가 재생 불가이거나 임베드가 막힌 경우는 **틀어 봐야 안다.** 플레이어에는 큐가
     * 있을 때 다음 곡으로 넘기는 길이 이미 있지만(`youtube-embed`), 봇 탑승은 `playSingle`
     * 이라 큐가 비어 있어 그 길을 못 탄다 — 그대로 두면 소리도 안 나고 넘어가지도 않는다.
     *
     * 곡만 떼어내고 `tick` 을 바로 불러 새 곡을 붙인다. 3초 주기를 기다리면 "바로 넘긴다" 가
     * 아니다.
     */
    const stopWatch = subscribePlayback((e) => {
      if (e.state !== "unavailable") return;
      // 다시 고르지 않는다. 한 번 안 된 곡은 다음에도 안 된다
      markDead(e.musicId);
      const bots = useBotStore.getState().bots;
      if (!bots.some((b) => b.episode.musicId === e.musicId)) return;
      useBotStore.getState().setBots(dropSong(bots, e.musicId));
      tick();
    });

    tick();
    const id = window.setInterval(tick, BOTS.tickMs);
    return () => {
      window.clearInterval(id);
      stopWatch();
    };
  }, [enabled, setBots, showToast, qc]);

  /**
   * 내가 겹을 옮겼다 — 딴 데 있는 봇들의 지금 에피소드를 **잘라 둔다**.
   *
   * 자르기만 하면 된다. 어디로 갈지는 평소 규칙(`nextLayer`)이 정하고, 그 규칙이 이미 내 겹으로
   * 강하게 끌린다. 여기서 겹을 직접 지정하면 전원이 한 프레임에 나타나 사람으로 안 보인다 —
   * 끝나는 시각을 제각각 흩어 두는 것이 이 함수가 하는 일의 전부다.
   */
  const layer = useMapStore((s) => s.layer);
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const [lo, hi] = BOTS.chaseMs;
    const store = useBotStore.getState();
    const next = store.bots.map((b) => {
      const soon = now + lo + Math.random() * (hi - lo);
      // 이미 곧 끝날 에피소드는 그냥 둔다 — 늘리는 쪽으로 손대면 도리어 느려진다
      return b.episode.layer !== layer && b.episode.endsAt > soon ? { ...b, episode: { ...b.episode, endsAt: soon } } : b;
    });
    store.setBots(next);
  }, [enabled, layer]);
}

/**
 * 내가 타고 있는 봇이 움직였으면 내 화면도 옮긴다.
 *
 * 실사용자를 따라갈 때 `RIDE_TRACK`·`RIDE_ENDED` 가 하는 일과 **같은 결과**를 만든다
 * (`use-ride-session`). 봇은 서버에 없어서 그 프레임이 올 데가 없다.
 */
function syncRide(before: Map<string, BotEpisode>, next: BotLive[], showToast: (m: string) => void): number | null {
  const ride = useFollowStore.getState();
  if (!ride.leaderEmail) return null;
  const leader = next.find((b) => b.email === ride.leaderEmail);
  if (!leader) return null;

  // 선장이 자리를 비웠다 — 인솔자가 사라진 것과 같은 상태다
  if (!leader.episode.online) {
    const map = useMapStore.getState();
    endRide({ musicId: map.myMusicId, layer: map.layer });
    showToast(RIDE_ENDED_BY_CAPTAIN(leader.nickname));
    return null;
  }

  /**
   * **봇이 겹을 옮기면 같이 옮긴다** (S15P21A405-560). 봇은 내가 있는 겹에서만 곡을 고를 수
   * 있어서, 안 따라가면 그 봇은 곡 없는 상태로 멈춘다 — 따라가기가 조용히 죽는다.
   */
  const toLayer = rideLayerTarget(useMapStore.getState().layer, leader.episode.layer);
  if (toLayer != null) getMapEngine()?.rideToLayer(toLayer, leader.episode.musicId ?? undefined);

  const was = before.get(leader.email);

  /**
   * **보고 있는 곡이 바뀌었다** — 실사용자의 `RIDE_PANEL` 자리다 (S15P21A405-551).
   * 재생은 건드리지 않는다. 상세만 바뀌는 경우가 실제로 있고, 그때 소리까지 갈아 끼우면
   * 인솔자가 옆 곡을 눌러 볼 때마다 따라가는 사람의 음악이 끊긴다.
   */
  const viewing = leader.episode.viewingMusicId;
  if (was?.viewingMusicId !== viewing) {
    ride.setLeaderViewingMusicId(viewing);
    const panel = usePanelStore.getState();
    if (viewing == null) panel.close();
    else {
      getMapEngine()?.rideViewing(viewing);
      useMapStore.getState().selectMusic(viewing);
      panel.openSong(viewing);
    }
  }

  const musicId = leader.episode.musicId;
  if (musicId == null || was?.musicId === musicId) return null;

  ride.setLeaderMusicId(musicId);
  useMapStore.getState().setMyMusicId(musicId);
  getMapEngine()?.rideTo(musicId);
  // 봇은 소리 있는 곡만 고르므로(`pickSong`) 여기서 재생 가부를 따지지 않는다
  playFrom(musicId, 0, true);
  // 실제로 소리가 나는지는 부르는 쪽이 이어서 확인한다 (§549)
  return musicId;
}
