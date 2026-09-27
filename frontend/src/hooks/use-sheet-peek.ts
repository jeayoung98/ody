"use client";

import { useEffect, type RefObject } from "react";
import { SHEET_PEEK_TOP_PX } from "@/constants/design-tokens";
import { usePanelStore } from "@/stores/use-panel-store";

/** `edge: "bottom"` 일 때 요소 아래로 남기는 여백(px) — 버튼이 시트 끝에 붙지 않게 */
const PEEK_GAP = 14;

/**
 * 폰 시트의 **1 단을 머리글 없이, 이 요소까지만** 걸리게 한다 (S15P21A405-703).
 *
 * 1 단(102px)은 머리글(곡 상세 · 신고 · ✕)이 절반을 먹었고, 머리글 아이콘과 아래 글의 좌우선이
 * 안 맞아 판이 떠 보였다. 1 단에서는 머리글을 접고(`globals.css` 의 `[data-peek]`) 손잡이 바로
 * 아래에서 본문을 시작한다. 걸리는 높이는 숫자로 적지 않고 **요소를 재서** 정한다.
 *
 * - `edge: "bottom"` — 요소 아래끝 + 여백까지 (곡 상세: 제목·가수·＋·▶ 줄)
 * - `edge: "top"` — 요소 윗끝까지, 요소는 안 보인다 (프로필: 팔로워·팔로잉 줄 위)
 *
 * **본문 윗끝에서 잰다.** 머리글이 접혔다 펴지면 시트 안에서 본문 전체가 오르내리는데, 본문
 * (`[data-sheet-body]`) 안의 거리는 그대로다 — 단이 바뀌어도 값이 안 흔들린다. 본문 위 여백은
 * 단마다 달라서 뺀다. 1 단에서 접히는 줄(앨범)이 요소 안에 있으면 요소 크기가 바뀌므로
 * `ResizeObserver` 가 다시 잰다.
 *
 * 시트 안이 아니면(넓은 화면의 우측 패널) 아무것도 하지 않는다.
 */
export function useSheetPeek(ref: RefObject<HTMLElement | null>, edge: "top" | "bottom") {
  useEffect(() => {
    const el = ref.current;
    const sheet = el?.closest<HTMLElement>("[data-sheet]");
    const body = el?.closest<HTMLElement>("[data-sheet-body]");
    if (!el || !sheet || !body) return;
    const setPeek = usePanelStore.getState().setSheetPeek;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const inBody = (edge === "bottom" ? r.bottom : r.top) - body.getBoundingClientRect().top - parseFloat(getComputedStyle(body).paddingTop);
      const px = Math.round(SHEET_PEEK_TOP_PX + inBody + (edge === "bottom" ? PEEK_GAP : 0));
      sheet.style.setProperty("--sheet-peek", `${px}px`);
      sheet.dataset.peek = "";
      setPeek(px);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      sheet.style.removeProperty("--sheet-peek");
      delete sheet.dataset.peek;
      setPeek(null);
    };
  }, [ref, edge]);
}
