"use client";

import { useMemo } from "react";

/** 바 개수. 양옆 시간 표시를 뺀 약 270px 에 2px 바가 2px 남짓 틈으로 이만큼 들어간다 */
const BARS = 64;
/** 옆 바와의 흔들림 시차(ms). 인덱스마다 이만큼 밀려 물결이 왼쪽에서 오른쪽으로 흐른다 */
const RIPPLE_MS = 70;

/**
 * `musicId` 로 고정된 **가짜 파형**. 곡마다 모양이 다르고 같은 곡은 늘 같다 — 새로고침해도 안 바뀐다.
 * 높이는 15~65% 사이다. 흔들릴 때 1.5배까지 커지므로 그래야 상자를 넘지 않는다.
 */
function shapeFor(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const noise = s / 2 ** 32;
    // 느린 봉우리 두어 개 위에 잡음을 얹는다 — 진짜 파형처럼 뭉쳤다 풀렸다 한다
    const envelope = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI * 2.3 + (seed % 7));
    // 정수 % 로 반올림한다 — 소수가 길면 서버가 그린 style 과 브라우저가 정규화한 값이 달라 하이드레이션 경고가 난다
    out.push(Math.round(100 * (0.15 + 0.5 * Math.min(1, noise * 0.6 + envelope * 0.5))));
  }
  return out;
}

interface WaveformBarsProps {
  musicId: number | null;
  /** 진행 비율 0~1 */
  ratio: number;
  /** 재생 중인가 — 바 전체가 물결처럼 움직인다 */
  playing: boolean;
  /** 들을 수 있는 곡인가. 아니면 전체를 흐리게 */
  live: boolean;
}

/**
 * 진행바의 **모양** — 바(bar) 파형 (S15P21A405-428). 지나간 구간은 색, 남은 구간은 회색.
 *
 * **실제 파형이 아니다.** 소리는 유튜브 iframe 안에서 나고, 브라우저는 그 오디오 샘플을 우리에게
 * 주지 않는다 (교차 출처). 그래서 곡마다 고정된 모양을 만들고, 재생 중에는 바 전체를 CSS 로 시차를
 * 두고 흔들어 "지금 소리가 난다" 를 보인다 — 연출이다. 헤드 근처만 흔들어 봤더니 일부만 움직여 어색했다. 음원을 직접 다루게 되면 그때 실측 파형으로 바꾼다.
 *
 * 조작은 위에 얹힌 투명한 `input[type=range]` 가 받는다 (`player-progress.tsx`). 이 컴포넌트는 그리기만 한다.
 */
export default function WaveformBars({ musicId, ratio, playing, live }: WaveformBarsProps) {
  const shape = useMemo(() => shapeFor(musicId ?? 0), [musicId]);
  const head = Math.round(ratio * BARS);

  return (
    <div aria-hidden className={`flex h-full items-center justify-between ${live ? "" : "opacity-45"}`}>
      {shape.map((h, i) => {
        const passed = i < head;
        return (
          <i
            key={i}
            className={`block w-[2px] shrink-0 rounded-pill ${passed ? "bg-teal" : "bg-white/[.16]"} ${playing ? "animate-wave" : ""}`}
            style={{ height: `${h}%`, animationDelay: playing ? `${(i * RIPPLE_MS) % 900}ms` : undefined }}
          />
        );
      })}
    </div>
  );
}
