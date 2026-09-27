"use client";

import { useMemo } from "react";

/** 바 개수. 양옆 시간 표시를 뺀 약 270px 에 2px 바가 2px 남짓 틈으로 이만큼 들어간다 */
const BARS = 64;
/** 재생 헤드 앞뒤로 이만큼의 바가 흔들린다. 전체를 흔들어 봤더니 징그럽다는 평 — 헤드 근처만 (S15P21A405-431) */
const LIVE_SPAN = 3;
/** 바 높이의 바닥과 상한(비율). 상한은 흔들림 1.5배를 곱해도 상자를 안 넘는 값이다 */
export const MIN_H = 0.08;
export const MAX_H = 0.65;
/**
 * 1 보다 크면 가운데 값이 아래로 내려간다 — 클수록 높은 바와 낮은 바의 대비가 커진다
 * (S15P21A405-456). 1 이면 예전처럼 다 비슷한 높이가 된다.
 */
const CONTRAST = 1.6;
/**
 * **아직 안 지나간** 바는 제 높이의 이만큼으로 낮아진다 (S15P21A405-460 · 464).
 *
 * 처음엔 헤드 근처를 뺀 전부를 눕혔는데, 그러면 지나온 구간도 같이 누워서 어디까지 들었는지가
 * 얇은 틸색 줄 하나로만 남았다. 지금은 **지나온 바가 제 높이로 선 채 남는다** — 헤드가 지나가며
 * 파형을 일으켜 세우고 가는, 자취가 쌓이는 모양이다 (`transition-[height]` 이 그 300ms 를 맡는다).
 *
 * 헤드는 여전히 읽힌다: 솟은 틸색과 누운 회색의 경계가 그 자리다. 멈춰 있어도 지나온 구간은 서 있다.
 */
const IDLE_SCALE = 0.35;

/**
 * `musicId` 로 고정된 **가짜 파형**. 곡마다 모양이 다르고 같은 곡은 늘 같다 — 새로고침해도 안 바뀐다.
 *
 * 높이는 8~65% 다. 상한은 흔들림(1.5배) 때문에 고정이고, 바닥은 15% 였던 것을 내렸다
 * (S15P21A405-456) — 두 난수를 더하면 값이 가운데로 모여서 64개가 다 40% 근처였다.
 * 지수 `CONTRAST` 가 그 가운데 덩어리를 아래로 끌어내려 높은 바와 낮은 바를 갈라 놓는다.
 */
export function shapeFor(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const noise = s / 2 ** 32;
    // 느린 봉우리 두어 개 위에 잡음을 얹는다 — 진짜 파형처럼 뭉쳤다 풀렸다 한다
    const envelope = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI * 2.3 + (seed % 7));
    // 정수 % 로 반올림한다 — 소수가 길면 서버가 그린 style 과 브라우저가 정규화한 값이 달라 하이드레이션 경고가 난다
    const level = Math.pow(Math.min(1, noise * 0.6 + envelope * 0.5), CONTRAST);
    out.push(Math.round(100 * (MIN_H + (MAX_H - MIN_H) * level)));
  }
  return out;
}

/**
 * 바 하나가 실제로 그려질 높이(%). 지나온 바와 헤드 근처 바는 제 높이, 나머지는 `IDLE_SCALE` 로 눕는다.
 *
 * 컴포넌트 밖에 둔 건 이 한 줄이 곧 "자취가 남는다" 의 전부라서다 — 460 때 한 번 눕혔다가 464 에서
 * 되세운 자리라, 테스트가 지키고 있지 않으면 또 눕는다.
 *
 * 정수 % 를 지킨다 — 소수가 길면 서버가 그린 style 과 브라우저가 정규화한 값이 달라 하이드레이션 경고가 난다.
 */
export function barHeight(h: number, i: number, head: number, playing: boolean) {
  const passed = i < head;
  const near = playing && Math.abs(i - head) <= LIVE_SPAN;
  return passed || near ? h : Math.round(h * IDLE_SCALE);
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
    <div aria-hidden className={`flex h-full items-center justify-between ${live ? "" : "opacity-45"}`}>
      {shape.map((h, i) => {
        const passed = i < head;
        const near = playing && Math.abs(i - head) <= LIVE_SPAN;
        const shown = barHeight(h, i, head, playing);
        return (
          <i
            key={i}
            className={`block w-[2px] shrink-0 rounded-pill transition-[height] duration-300 ${passed ? "bg-teal" : "bg-white/[.16]"} ${near ? "animate-wave" : ""}`}
            style={{ height: `${shown}%`, animationDelay: near ? `${(i % 4) * 110}ms` : undefined }}
          />
        );
      })}
    </div>
  );
}
