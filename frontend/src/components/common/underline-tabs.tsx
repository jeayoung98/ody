"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface UnderlineTabsProps<T extends string> {
  items: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}

/**
 * 밑줄 탭 — 글자 아래 포인트색 2px 줄이 선택한 탭으로 **미끄러진다** (S15P21A405-435).
 *
 * 기존 `Tabs`(알약 안 채움 배경)와 다른 문법이다: 그쪽은 상자 안에서 "고르기", 이쪽은 내용
 * 구획 사이를 "넘기기". 곡 상세처럼 아래 내용이 통째로 바뀌는 자리에 쓴다.
 *
 * 탭은 가로 폭을 똑같이 나눠 꽉 채운다 (`flex-1`) — 왼쪽으로 몰려 있으면 비어 보인다.
 * 밑줄은 버튼마다 하나씩 두지 않고 **하나만** 두고 자리를 옮긴다 — 그래야 움직임이 보인다.
 * 자리는 선택된 버튼의 `offsetLeft/offsetWidth` 를 재서 잡는다. 탭 개수가 바뀌어도(관련 플리가
 * 생겼다 없어졌다) 다시 잰다.
 */
export default function UnderlineTabs<T extends string>({ items, value, onChange }: UnderlineTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${value}"]`);
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, items]);

  return (
    <div ref={listRef} role="tablist" className="relative flex border-b border-line">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          data-key={item.key}
          aria-selected={value === item.key}
          onClick={() => onChange(item.key)}
          className={`flex-1 px-3 py-2 text-center text-[13px] transition-colors duration-fast ${value === item.key ? "font-medium text-ink" : "text-ink-3 hover:text-ink-2"}`}
        >
          {item.label}
        </button>
      ))}
      {/* 밑줄 하나 — 아래 테두리 위에 겹쳐서 선택 탭 아래만 포인트색으로 */}
      <span
        aria-hidden
        className="absolute -bottom-px h-[2px] rounded-pill bg-teal transition-[transform,width] duration-300 ease-out"
        style={{ width: bar.width, transform: `translateX(${bar.left}px)` }}
      />
    </div>
  );
}
