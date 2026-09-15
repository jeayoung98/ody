"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";
import { getPlayer } from "./player-registry";

/** 재생 시계를 물어보는 주기(ms). 3px 바에서는 이보다 촘촘해도 눈에 안 보인다 */
const TICK_MS = 250;

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
 * #tBar — 재생 진행 바 겸 **위치 조절기** (S15P21A405-334).
 *
 * 예전에는 500ms 인터벌로 혼자 채우는 가짜 바였다. 실제 재생과 이어져 있지 않아서 유튜브 쪽에서
 * 되감아도 몰랐고, 곡 길이를 모르면 30초 데모를 되풀이했다. 이제 임베드가 띄운 공식 플레이어에게
 * 매 틱 시간을 물어보고, 사용자가 옮기면 `seekTo` 로 그 자리에 놓는다.
 *
 * **네이티브 `input[type=range]` 를 쓴다.** 끌기·클릭·키보드 화살표·스크린리더가 전부 공짜로
 * 따라온다 — div 로 만들면 그걸 전부 다시 짜야 한다. 칠해진 구간은 배경 그라데이션의 정지점을
 * 값에 맞춰 옮겨서 낸다.
 *
 * 끄는 동안에는 플레이어가 보고하는 시간을 무시한다 (`scrub`). 안 그러면 손가락이 끄는 값과 아직
 * 안 옮겨진 재생 위치가 매 틱 서로를 덮어써서 손잡이가 튄다.
 */
export default function PlayerProgress({ musicId, durationSec, canPlay = false }: PlayerProgressProps) {
  const [clock, setClock] = useState({ musicId, t: 0, duration: 0 });
  /** 끄는 중인 값(초). null 이면 플레이어 시계를 따른다 */
  const [scrub, setScrub] = useState<number | null>(null);

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
      setClock((c) => ({
        ...c,
        t: Number.isFinite(t) ? t : c.t,
        duration: Number.isFinite(duration) && duration > 0 ? duration : c.duration,
      }));
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
  /** 옮길 수 있으려면 들을 수 있는 곡이어야 하고, 플레이어가 길이를 알려줬어야 한다 */
  const seekable = canPlay && duration > 0;
  /** 읽어 주는 길이는 곡 정보로 미리 채워도 된다 — 눈금과 달리 틀려도 옮겨지는 자리가 바뀌지 않는다 */
  const shownDuration = duration || (durationSec != null && durationSec > 0 ? durationSec : 0);

  const commit = (next: number) => {
    getPlayer()?.seekTo(next, true);
    setClock((c) => ({ ...c, t: next }));
    setScrub(null);
  };

  return (
    <span className="mt-[5px] flex items-center gap-1.5">
      <input
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
         * 이 바는 패널을 여는 버튼 **옆에** 있다 (`player-bar.tsx`). 바깥 레이아웃이 다시 바뀌어
         * 버튼 안으로 들어가는 일이 생겨도 패널이 같이 열리지 않게, 여기서 한 번 더 막는다.
         */
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-[3px] min-w-0 flex-1 cursor-pointer appearance-none rounded-pill bg-transparent disabled:cursor-default disabled:opacity-60 [&::-moz-range-thumb]:h-[9px] [&::-moz-range-thumb]:w-[9px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-[9px] [&::-webkit-slider-thumb]:w-[9px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-white"
        style={{
          // 칠해진 구간 = 그라데이션 정지점을 값에 맞춰 옮긴 것. 트랙 하나로 두 색을 낸다
          background: `linear-gradient(to right, var(--color-teal) 0%, var(--color-violet) ${ratio * 100}%, rgba(255,255,255,.1) ${ratio * 100}%)`,
        }}
      />
      {/* 못 트는 곡이어도 길이는 알려 준다 — 바만 잠근다 */}
      <span className="num shrink-0 text-[9px] text-ink-4 tabular-nums">
        {shownDuration > 0 ? `${formatDuration(Math.round(value))} / ${formatDuration(Math.round(shownDuration))}` : "--:--"}
      </span>
    </span>
  );
}
