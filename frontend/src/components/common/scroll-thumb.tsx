"use client";

import { useEffect, useRef, type RefObject } from "react";

/** 막대 최소 길이(px). 아주 긴 목록에서도 점으로 줄어들지 않게 */
const MIN_H = 28;
/** 굴림이 멈추고 사라지기까지(ms) */
const FADE_AFTER = 650;

/**
 * 굴릴 때만 잠깐 뜨는 스크롤 막대 (S15P21A405-477).
 *
 * 네이티브 막대는 **자리를 차지한다.** 8px 짜리 기둥이 패널 안쪽 폭을 먹고, 유리 위에 회색 띠
 * 하나가 늘 서 있다. 그래서 네이티브는 폭 0 으로 지우고(`.scroll-quiet`) 내용 **위에 띄운**
 * 막대를 대신 그린다 — 굴리는 동안만 보였다가 손을 떼면 사라진다.
 *
 * 스크롤 상자의 부모가 `relative` 여야 하고, 그 부모는 상자와 같은 크기여야 한다 (`Box` 참고).
 *
 * 값은 상태로 들고 있지 않고 DOM 에 바로 쓴다 — 한 번 굴릴 때 수십 번 바뀌는 값이라
 * 리렌더로 옮기면 패널 전체가 그만큼 다시 그려진다.
 */
export default function ScrollThumb({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sc = scrollerRef.current;
    const thumb = thumbRef.current;
    if (!sc || !thumb) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /** 길이·위치만 다시 잰다. 보이고 숨기는 건 건드리지 않는다 */
    const draw = () => {
      const room = sc.scrollHeight - sc.clientHeight;
      if (room < 1) return;
      const h = Math.max(MIN_H, (sc.clientHeight / sc.scrollHeight) * sc.clientHeight);
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translateY(${(sc.scrollTop / room) * (sc.clientHeight - h)}px)`;
    };

    const onScroll = () => {
      // 굴릴 자리가 없으면 막대도 없다 — 짧은 패널에 띠만 번쩍이지 않게
      if (sc.scrollHeight - sc.clientHeight < 1) return;
      draw();
      thumb.style.opacity = "1";
      clearTimeout(timer);
      timer = setTimeout(() => {
        thumb.style.opacity = "0";
      }, FADE_AFTER);
    };

    draw();
    sc.addEventListener("scroll", onScroll, { passive: true });
    // 패널 높이가 바뀌면 길이도 달라진다. 내용이 바뀌는 경우는 다음 굴림에서 다시 잰다
    const ro = new ResizeObserver(draw);
    ro.observe(sc);
    return () => {
      sc.removeEventListener("scroll", onScroll);
      ro.disconnect();
      clearTimeout(timer);
    };
  }, [scrollerRef]);

  return (
    <div
      ref={thumbRef}
      aria-hidden
      className="pointer-events-none absolute top-0 right-[3px] w-[3px] rounded-full bg-white/30 opacity-0 transition-opacity duration-300"
    />
  );
}
