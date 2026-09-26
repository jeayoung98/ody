"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import { publishSeek } from "@/lib/realtime/ride";
import { useFollowStore } from "@/stores/use-follow-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { getPlayer } from "./player-registry";
import WaveformBars from "./waveform-bars";
import { track } from "@/lib/analytics/client";

/** 재생 시계를 물어보는 주기(ms). 바 64개짜리 파형에서는 이보다 촘촘해도 눈에 안 보인다 */
const TICK_MS = 250;
/** 옮긴 뒤 플레이어가 새 자리를 말해 줄 때까지 예전 시간을 무시하는 한도(ms) — 그래도 안 오면 플레이어를 믿는다 */
const SEEK_SETTLE_MS = 1500;
/** 플레이어 시간이 옮긴 자리에서 이만큼(초) 안이면 "도착" 으로 친다 */
const SEEK_TOLERANCE_S = 1.5;

interface PlayerProgressProps {
  musicId: number | null;
  /** 곡 길이(초). **읽어 주는 용도만** 이다 — 눈금은 플레이어가 말한 길이를 쓴다 (아래 참고) */
  durationSec?: number | null;
  /**
   * 사이트 안에서 들을 수 있는 곡인가 (`videoId` 유무).
   *
   * **길이만으로 판단하면 안 된다.** 재생 불가 곡도 곡 정보에는 길이가 있어서, 그것만 보면
   * 끌 수 있는 바처럼 보이는데 플레이어는 아무 영상도 물고 있지 않아 눌러도 아무 일이 없다.
   */
  canPlay?: boolean;
}

/**
 * #tBar — 재생 진행 바 겸 **위치 조절기** (S15P21A405-334). 모양은 바 파형이다 (S15P21A405-428, `waveform-bars.tsx`).
 *
 * 예전에는 500ms 인터벌로 혼자 채우는 가짜 바였다. 실제 재생과 이어져 있지 않아서 유튜브 쪽에서
 * 되감아도 몰랐고, 곡 길이를 모르면 30초 데모를 되풀이했다. 이제 임베드가 띄운 공식 플레이어에게
 * 매 틱 시간을 물어보고, 사용자가 옮기면 `seekTo` 로 그 자리에 놓는다.
 *
 * **조작은 여전히 네이티브 `input[type=range]` 다.** 파형 위에 투명하게 얹었다 — 끌기·클릭·키보드
 * 화살표·스크린리더가 전부 공짜로 따라온다. div 로 만들면 그걸 전부 다시 짜야 한다.
 * 포커스 테두리는 두지 않는다 — 마우스로 눌러도 떠서 거슬렸다. 위치는 색이 찬 구간이 말해 준다.
 *
 * 끄는 동안에는 플레이어가 보고하는 시간을 무시한다 (`scrub`). 안 그러면 손가락이 끄는 값과 아직
 * 안 옮겨진 재생 위치가 매 틱 서로를 덮어써서 손잡이가 튄다.
 *
 * **옮긴 직후에도 잠깐 무시한다** (`pendingSeek`, S15P21A405-431). `seekTo` 는 비동기라 다음 틱에
 * 플레이어가 아직 예전 시간을 돌려주는데, 그걸 그대로 받으면 바가 예전 자리로 튀었다가 다시 온다.
 * 플레이어 시간이 목표 근처에 닿거나 한도를 넘길 때까지 우리가 놓은 값을 지킨다 — 낙관적 반영이다.
 */
export default function PlayerProgress({ musicId, durationSec, canPlay = false }: PlayerProgressProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [clock, setClock] = useState({ musicId, t: 0, duration: 0 });
  /** 끄는 중인 값(초). null 이면 플레이어 시계를 따른다 */
  const [scrub, setScrub] = useState<number | null>(null);
  /** 방금 옮긴 자리. 플레이어가 따라올 때까지 시계를 여기에 붙들어 둔다 */
  const pendingSeek = useRef<{ t: number; until: number } | null>(null);

  // 곡이 바뀌면 렌더 중에 0으로 맞춘다 (effect 안 setState 대신 "adjusting state during render")
  if (clock.musicId !== musicId) {
    setClock({ musicId, t: 0, duration: 0 });
    setScrub(null);
  }

  useEffect(() => {
    if (musicId == null) return;
    const id = setInterval(() => {
      const p = getPlayer();
      if (!p) return;
      const t = p.getCurrentTime();
      const duration = p.getDuration();
      const pending = pendingSeek.current;
      if (pending) {
        // 도착했거나 너무 오래 기다렸으면 다시 플레이어를 따른다
        if (Math.abs(t - pending.t) <= SEEK_TOLERANCE_S || Date.now() > pending.until) pendingSeek.current = null;
      }
      setClock((c) => {
        const nt = pendingSeek.current ? c.t : Number.isFinite(t) ? t : c.t;
        const nd = Number.isFinite(duration) && duration > 0 ? duration : c.duration;
        /**
         * 값이 그대로면 **같은 객체를 돌려준다.** 매 틱 새 객체를 만들면 멈춰 있을 때도, 아예 플레이어가
         * 없을 때도 초당 4번씩 다시 그린다 — 바는 한 픽셀도 안 움직이는데.
         */
        return nt === c.t && nd === c.duration ? c : { ...c, t: nt, duration: nd };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [musicId]);

  /**
   * **눈금은 플레이어가 말한 길이만 쓴다.** 곡 정보의 길이(`durationSec`)로 대신하면 안 된다 —
   * 둘이 다를 수 있어서(실측: 곡 정보 3:58 vs 영상 3:11) 그 창에서 끌면 엉뚱한 초로 간다.
   * 아직 길이를 모르면 옮길 수 없는 상태로 둔다. 곧 도착한다.
   */
  const duration = clock.duration;
  const value = Math.min(scrub ?? clock.t, duration || Infinity);
  const ratio = duration > 0 ? value / duration : 0;
  /**
   * 옮길 수 있으려면 들을 수 있는 곡이어야 하고, 플레이어가 길이를 알려줬어야 한다.
   *
   * **따라가는 중에도 못 옮긴다** (S15P21A405-567). 옮기면 서버의 선단 상태와 내 소리가
   * 갈라지는데 **서버는 그 사실을 모른다** — 다음 `RIDE_PLAYBACK` 이 올 때까지 조용히 어긋난
   * 채로 남는다. 정지 버튼을 막은 이유와 같다.
   *
   * 지금 위치와 길이는 그대로 보여 준다. 못 트는 곡에서 바만 잠그는 방식과 같다.
   */
  const riding = useFollowStore((s) => s.leaderEmail != null);
  const seekable = canPlay && duration > 0 && !riding;
  /** 읽어 주는 길이는 곡 정보로 미리 채워도 된다 — 눈금과 달리 틀려도 옮겨지는 자리가 바뀌지 않는다 */
  const shownDuration = duration || (durationSec != null && durationSec > 0 ? durationSec : 0);

  const commit = (next: number) => {
    if (!seekable || scrub == null) return;
    track("play_seeked", { music_id: musicId, from_sec: Math.round(clock.t), to_sec: Math.round(next) });
    getPlayer()?.seekTo(next, true);
    /**
     * 따라오는 사람들에게 같은 자리로 옮기라고 알린다 (2차 실시간 명세 §5.1, S15P21A405-530).
     * **놓았을 때 한 번만 나간다** — 끄는 내내 보내면 그대로 다 전달된다. 여기가 커밋 지점이라
     * 이미 한 번이지만, 키보드 화살표 연타처럼 잦은 커밋도 있어 발행 간격을 한 겹 더 둔다.
     */
    publishSeek(Math.round(next * 1000));
    pendingSeek.current = { t: next, until: Date.now() + SEEK_SETTLE_MS };
    setClock((c) => ({ ...c, t: next }));
    setScrub(null);
  };

  return (
    <div className="flex items-center gap-2.5">
      {/* 못 트는 곡이어도 길이는 알려 준다 — 바만 잠근다 */}
      {/*
        12px · w-8 이었다 (S15P21A405-649). 키우면서 칸도 넓힌다 — `12:34` 와 `--:--` 가 다섯
        글자라 32px 에서는 12px 로도 빠듯했고, 13.5px 이면 끝자리가 잘린다.
        폰에서는 8px · 24px 칸이다 (S15P21A405-703, 사용자 결정) — 한 줄짜리 재생바에서 시간이 선보다 눈에 띄었다.
      */}
      <span className="num w-10 shrink-0 text-[13.5px] text-ink-4 tabular-nums max-tablet:w-6 max-tablet:text-[8px]">{shownDuration > 0 ? formatDuration(Math.round(value)) : "--:--"}</span>
      {/* 좁은 화면에서는 파형을 8px 로 눕힌다 — 자리는 거의 안 먹으면서 어디까지 왔는지는 보인다 */}
      <div className="relative h-8 min-w-0 flex-1 max-tablet:h-2">
        {/*
          **폰에서는 파형 대신 곧은 선이다** (S15P21A405-703). 8px 로 눕힌 파형은 흔들리는 바가
          너무 작아 떨리는 잡티로 읽혔다. 선의 찬 길이가 곧 진행이다 — 조작은 위 input 이 그대로 받는다.
        */}
        <div className="h-full max-tablet:hidden">
          <WaveformBars musicId={musicId} ratio={ratio} playing={isPlaying && seekable && scrub == null} live={canPlay} />
        </div>
        <div aria-hidden className={`absolute inset-x-0 top-1/2 hidden h-[3px] -translate-y-1/2 overflow-hidden rounded-pill bg-white/[.16] max-tablet:block ${canPlay ? "" : "opacity-45"}`}>
          <div className="h-full rounded-pill bg-teal" style={{ width: `${Math.round(ratio * 1000) / 10}%` }} />
        </div>
        <input
          data-analytics-manual
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={value}
          disabled={!seekable}
          aria-label="재생 위치"
          aria-valuetext={`${formatDuration(Math.round(value))} / ${formatDuration(Math.round(shownDuration))}`}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
          /**
           * 제목 버튼이 바로 위에 있다 (`player-bar.tsx`). 바깥 레이아웃이 다시 바뀌어
           * 버튼 안으로 들어가는 일이 생겨도 패널이 같이 열리지 않게, 여기서 한 번 더 막는다.
           */
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          // 투명하게 파형 위에 얹는다 — 트랙도 손잡이도 안 보이고 조작만 받는다
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 outline-none disabled:cursor-default"
        />
      </div>
      <span className="num w-10 shrink-0 text-right text-[13.5px] text-ink-4 tabular-nums max-tablet:w-6 max-tablet:text-[8px]">{shownDuration > 0 ? formatDuration(Math.round(shownDuration)) : "--:--"}</span>
    </div>
  );
}
