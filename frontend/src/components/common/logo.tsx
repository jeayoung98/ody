"use client";

import { useId } from "react";

interface LogoProps {
  /** 한 변(px). 정사각형이다 */
  size: number;
  /** 모서리 반지름 — viewBox(64) 기준 단위. 16 이면 한 변의 1/4 */
  radius?: number;
  /** 뒤의 별이 반짝이는가. 목록처럼 많이 그리는 자리는 끄면 된다 */
  twinkle?: boolean;
  className?: string;
}

/**
 * 별 위의 별. 크기·주기·시작 시점을 다르게 둬 한꺼번에 깜빡이지 않게 한다 (viewBox 64 기준).
 * 로켓이 가운데 기울어 있으니 별은 가장자리에만 — 몸통 위에 겹치면 로켓이 얼룩져 보인다.
 */
const STARS = [
  { x: 11, y: 12, r: 1.6, dur: 2.6, begin: -0.4 },
  { x: 50, y: 9, r: 1.2, dur: 3.1, begin: -1.6 },
  { x: 55, y: 26, r: 1.0, dur: 2.2, begin: -0.9 },
  { x: 8, y: 34, r: 1.1, dur: 2.9, begin: -2.1 },
  { x: 16, y: 54, r: 1.4, dur: 2.4, begin: -1.2 },
  { x: 46, y: 56, r: 1.0, dur: 3.4, begin: -0.2 },
  { x: 31, y: 7, r: 0.9, dur: 2.0, begin: -1.9 },
] as const;

/**
 * ODY 로고 마크 (S15P21A405-651) — 파비콘(`app/icon.svg`)의 로켓을 **지도 배경 남색** 위에 올리고 뒤에 별을 몇 개 뿌린 것.
 *
 * 좌상단 브랜드 · 로그인 판정 스플래시 · 로그인 카드가 같은 마크를 쓴다. 예전에는 세 곳이 청록→보라 그라데이션 사각형이었고
 * 파비콘만 로켓이라 탭과 화면이 다른 얼굴이었다. 로켓 좌표는 파비콘과 같다(지도 우주선 `draw-friends.ts` `drawShip` 의 R=40
 * 캔버스 값, 40도 기울임) — **셋을 같이 고친다.**
 *
 * 배경은 지도 캔버스 바닥(`--color-void`)에 가운데만 살짝 남색을 올린 방사형이다 — 평면 남색 한 색이면 26px 에서 검은 점으로 읽힌다.
 * `clipPath` id 는 `useId` 로 만든다 — 한 화면에 로고가 둘 이상이면 같은 id 가 서로를 가린다.
 */
export default function Logo({ size, radius = 16, twinkle = true, className = "" }: LogoProps) {
  const uid = useId();
  const bg = `${uid}-bg`;
  const body = `${uid}-body`;
  const clip = `${uid}-clip`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className}`}
      style={{ borderRadius: `${(radius / 64) * 100}%` }}
    >
      <defs>
        <radialGradient id={bg} cx="42%" cy="36%" r="75%">
          <stop offset="0" stopColor="#0c1838" />
          <stop offset="1" stopColor="var(--color-void)" />
        </radialGradient>
        <path id={body} d="M 0 -50 C 26 -50 42 -20 42 6 C 42 32 30 54 18 60 L -18 60 C -30 54 -42 32 -42 6 C -42 -20 -26 -50 0 -50 Z" />
        <clipPath id={clip}>
          <use href={`#${body}`} />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx={radius} fill={`url(#${bg})`} />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e9f1ff" opacity={0.85}>
          {twinkle && <animate attributeName="opacity" values="0.15;0.95;0.15" dur={`${s.dur}s`} begin={`${s.begin}s`} repeatCount="indefinite" />}
        </circle>
      ))}
      <g transform="translate(32 32) rotate(40) scale(0.34) translate(0 -10)">
        {/* 지느러미 */}
        <path d="M -30 22 C -50 34 -58 50 -56 62 C -50 64 -36 60 -26 56 Z" fill="#4fe3ce" />
        <path d="M 30 22 C 50 34 58 50 56 62 C 50 64 36 60 26 56 Z" fill="#4fe3ce" />
        {/* 몸통 두 톤 */}
        <use href={`#${body}`} fill="#e9f1ff" />
        <rect x="0" y="-56" width="60" height="130" fill="#cfd9f7" clipPath={`url(#${clip})`} />
        {/* 꼬리 밴드 */}
        <path d="M -18 60 L 18 60 C 18 66 10 70 0 70 C -10 70 -18 66 -18 60 Z" fill="#a67cff" />
        {/* 창 */}
        <circle cx="0" cy="0" r="33.6" fill="#3a4761" />
        <circle cx="0" cy="0" r="28.8" fill="#a67cff" />
        <circle cx="-9" cy="-9" r="6.4" fill="#ffffff" fillOpacity="0.35" />
      </g>
    </svg>
  );
}
