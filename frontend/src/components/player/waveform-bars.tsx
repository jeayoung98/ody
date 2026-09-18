"use client";

import { useMemo } from "react";

/** 바 개수. 376px 폭에서 3px 바 + 2px 틈이면 이만큼 들어간다 */
const BARS = 56;
/** 재생 헤드 앞뒤로 이만큼의 바가 흔들린다 */
const LIVE_SPAN = 3;

/**
 * `musicId` 로 고정된 **가짜 파형**. 곡마다 모양이 다르고 같은 곡은 늘 같다 — 새로고침해도 안 바뀐다.
 * 높이는 0.15~0.65 사이다. 흔들릴 때 1.5배까지 커지므로 그래야 상자를 넘지 않는다.
 */
function shapeFor(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const noise = s / 2 ** 32;
    // 느린 봉우리 두어 개 위에 잡음을 얹는다 — 진짜 파형처럼 뭉쳤다 풀렸다 한다
    const envelope = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI * 2.3 + (seed % 7));
    out.push(0.15 + 0.5 * Math.min(1, noise * 0.6 + envelope * 0.5));
  }
  return out;
}

interface WaveformBarsProps {
  musicId: number | null;
  /** 진행 비율 0~1 */
  ratio: number;
  /** 재생 중인가 — 헤드 근처 바가 움직인다 */
  playing: boolean;
  /** 들을 수 있는 곡인가. 아니면 전체를 흐리게 */
  live: boolean;
}

/**
 * 진행바의 **모양** — 바(bar) 파형 (S15P21A405-428). 지나간 구간은 색, 남은 구간은 회색.
 *
 * **실제 파형이 아니다.** 소리는 유튜브 iframe 안에서 나고, 브라우저는 그 오디오 샘플을 우리에게
 * 주지 않는다 (교차 출처). 그래서 곡마다 고정된 모양을 만들고, 재생 중에는 헤드 근처 바만 CSS 로
 * 흔들어 "지금 소리가 난다" 를 보인다 — 연출이다. 음원을 직접 다루게 되면 그때 실측 파형으로 바꾼다.
 *
 * 조작은 위에 얹힌 투명한 `input[type=range]` 가 받는다 (`player-progress.tsx`). 이 컴포넌트는 그리기만 한다.
 */
export default function WaveformBars({ musicId, ratio, playing, live }: WaveformBarsProps) {
  const shape = useMemo(() => shapeFor(musicId ?? 0), [musicId]);
  const head = Math.round(ratio * BARS);

  return (
    <div aria-hidden className={`flex h-full items-center gap-[2px] ${live ? "" : "opacity-45"}`}>
      {shape.map((h, i) => {
        const passed = i < head;
        const near = playing && Math.abs(i - head) <= LIVE_SPAN;
        return (
          <i
            key={i}
            className={`block min-w-0 flex-1 rounded-pill ${passed ? "bg-teal" : "bg-white/[.16]"} ${near ? "animate-wave" : ""}`}
            style={{ height: `${h * 100}%`, animationDelay: near ? `${(i % 4) * 110}ms` : undefined }}
          />
        );
      })}
    </div>
  );
}
