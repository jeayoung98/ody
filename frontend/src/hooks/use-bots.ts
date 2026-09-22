"use client";

import { useEffect } from "react";
import { BOTS, RIDE_ENDED_BY_CAPTAIN } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { isKnownArtist } from "@/lib/bots/known-artists";
import { BOT_ROSTER } from "@/lib/bots/roster";
import { nextEpisode, rnd, type BotEpisode } from "@/lib/bots/sim";
import { endRide, playFrom } from "@/lib/realtime/ride";
import { useBotStore, type BotLive } from "@/stores/use-bot-store";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
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
          if (picked != null) episode = { ...episode, musicId: picked };
        }

        return { ...seedInfo, episode };
      });

      setBots(next);
      syncRide(before, next, showToast);
    };

    tick();
    const id = window.setInterval(tick, BOTS.tickMs);
    return () => window.clearInterval(id);
  }, [enabled, setBots, showToast]);

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
 * 이 봇이 들을 곡 하나.
 *
 * **절반 넘게 내 곡 근처에서 고른다.** 주변 사람 패널은 "내가 듣는 곡과 비슷한 곡을 듣는 사람"
 * 이라, 아무 데서나 고르면 봇은 지도에만 보이고 그 패널에는 영영 안 뜬다 — 정작 따라가기를
 * 누르는 자리가 거기다. 사람이 인기 있는 구역에 몰리는 것은 실제로도 그러하다.
 *
 * **소리가 없는 곡은 아예 안 고른다.** 봇을 따라갔는데 아무것도 안 들리면 따라가기가 고장 난
 * 것처럼 보인다 — 실사용자는 그런 곡에 설 수 있지만 봇은 시연이 목적이라 피해 간다.
 *
 * **아는 가수의 곡을 먼저 본다** (S15P21A405-543). 662만 곡에서 무작위로 돌리면 사람이 모르는
 * 곡만 나오는데, 시연에서 "누가 이 곡을 듣고 있다" 는 아는 곡일 때만 사람으로 읽힌다.
 * 그 겹에 아는 곡이 거의 없으면 **평소대로 고른다** — 한두 곡에 여섯이 겹쳐 서느니 모르는
 * 곡이라도 흩어지는 편이 낫다.
 */
function pickSong(layer: number, myLayer: number, myMusicId: number | null): number | null {
  const engine = getMapEngine();
  if (layer !== myLayer || !engine?.ready) return null;
  const playable = engine.songs.filter((s) => s.playable);
  const known = playable.filter((s) => isKnownArtist(s.artist));
  const songs = known.length >= BOTS.knownMin ? known : playable;
  if (songs.length === 0) return null;

  const mine = myMusicId != null ? engine.pointOf(myMusicId) : null;
  if (!mine || Math.random() < BOTS.wanderChance) return songs[Math.floor(Math.random() * songs.length)].musicId;

  const dx = layer * 2;
  const dy = dx + 1;
  const near = songs
    .map((s) => ({ id: s.musicId, d: (s.pc[dx] - mine.pc[dx]) ** 2 + (s.pc[dy] - mine.pc[dy]) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, BOTS.nearPool);
  return near[Math.floor(Math.random() * near.length)].id;
}

/**
 * 내가 타고 있는 봇이 움직였으면 내 화면도 옮긴다.
 *
 * 실사용자를 따라갈 때 `RIDE_TRACK`·`RIDE_ENDED` 가 하는 일과 **같은 결과**를 만든다
 * (`use-ride-session`). 봇은 서버에 없어서 그 프레임이 올 데가 없다.
 */
function syncRide(before: Map<string, BotEpisode>, next: BotLive[], showToast: (m: string) => void): void {
  const ride = useFollowStore.getState();
  if (!ride.leaderEmail) return;
  const leader = next.find((b) => b.email === ride.leaderEmail);
  if (!leader) return;

  // 선장이 자리를 비웠다 — 인솔자가 사라진 것과 같은 상태다
  if (!leader.episode.online) {
    const map = useMapStore.getState();
    endRide({ musicId: map.myMusicId, layer: map.layer });
    showToast(RIDE_ENDED_BY_CAPTAIN(leader.nickname));
    return;
  }

  const was = before.get(leader.email);
  const musicId = leader.episode.musicId;
  if (musicId == null || was?.musicId === musicId) return;

  ride.setLeaderMusicId(musicId);
  useMapStore.getState().setMyMusicId(musicId);
  getMapEngine()?.rideTo(musicId);
  // 봇은 소리 있는 곡만 고르므로(`pickSong`) 여기서 재생 가부를 따지지 않는다
  playFrom(musicId, 0, true);
}
