"use client";

import { useEffect, useRef } from "react";

/** 초당 흐르는 픽셀. 빠르면 못 읽고 느리면 안 끝난다 */
const SPEED = 38;
/** 사본과의 간격(px). 붙어 있으면 한 낱말처럼 읽힌다 */
const GAP = 48;

/**
 * 폭에 안 들어가는 한 줄을 **옆으로 흘린다** (S15P21A405-384).
 *
 * 곡 제목·아티스트는 길이가 제각각인데 우측 패널 폭은 고정이다. 말줄임(`truncate`)으로 자르면
 * 긴 제목은 뒷부분을 영영 못 본다. 넘칠 때만 흐르게 하고, **안 넘치면 아무 일도 하지 않는다** —
 * 짧은 제목까지 흔들리면 읽기만 힘들다.
 *
 * 넘치는지는 브라우저에서 재야 안다. 상태로 들고 있으면 서버 렌더와 값이 달라 하이드레이션이
 * 깨지므로 **DOM 에 직접 쓴다** — 기본값 `data-run="off"` 로 나가고, 재 보고 넘칠 때만 켠다.
 * 사본은 꺼진 동안 `display:none` 이라 같은 글자가 두 번 보이지 않는다.
 */
export default function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const lead = box?.firstElementChild?.firstElementChild as HTMLElement | undefined;
    if (!box || !lead) return;

    const measure = () => {
      // 사본이 숨은 채로 재야 원래 글자 폭이 나온다 — 재는 동안은 항상 꺼 둔다
      box.dataset.run = "off";
      const overflow = lead.scrollWidth - box.clientWidth;
      if (overflow <= 1) return;
      const shift = lead.scrollWidth + GAP;
      box.style.setProperty("--marquee-shift", `${shift}px`);
      box.style.setProperty("--marquee-dur", `${shift / SPEED}s`);
      box.dataset.run = "on";
    };

    measure();
    // 패널 폭은 고정이지만 글꼴이 늦게 올라오면 폭이 바뀐다
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={boxRef} data-run="off" className={`marquee block ${className}`}>
      <span className="marquee-track">
        <span>{text}</span>
        <span className="marquee-copy" style={{ marginLeft: GAP }} aria-hidden>
          {text}
        </span>
      </span>
    </span>
  );
}
