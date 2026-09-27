"use client";

import { useEffect, type RefObject } from "react";
import { usePanelStore } from "@/stores/use-panel-store";

/** 멈춤 요소 아래로 남기는 여백(px) — Box 본문 아래 여백과 비슷하게, 버튼이 시트 끝에 붙지 않게 */
const STOP_GAP = 14;

/**
 * 폰 시트의 **2 단 높이를 이 요소 아래끝에 맞춘다** (S15P21A405-703).
 *
 * 2 단 높이는 곡 상세에 맞춘 한 값(`--spacing-sheet-s2` 238px)이라, 프로필에서는 팔로우·따라가기
 * 버튼이 반쯤 걸리거나 그 아래 통계 줄까지 올라왔다. 내용마다 숫자를 적는 대신 **멈출 요소를
 * 재서** 시트에 알린다 — 닉네임이 길어 줄이 바뀌거나 오프라인 안내가 붙어도 같이 따라간다.
 *
 * 시트 요소(`[data-sheet]`)에 `--sheet-stop` 과 `data-stop` 을 심으면 `globals.css` 가 2 단 자리를
 * 그 값으로 바꾼다. 같은 값을 스토어에도 넣어 지도 가림폭이 읽게 한다.
 * 시트 안이 아니면(넓은 화면의 우측 패널) 아무것도 하지 않는다 — 거기에는 단이 없다.
 */
export function useSheetStop(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const sheet = el?.closest<HTMLElement>("[data-sheet]");
    if (!el || !sheet) return;
    const setStop = usePanelStore.getState().setSheetStop;

    const measure = () => {
      /**
       * 시트는 단마다 통째로 미끄러지므로 두 상자의 **차이**만 본다. 3 단에서 굴려 둔 채 내려오면
       * 요소가 그만큼 위에 있으니 스크롤 양을 되돌려 더한다.
       */
      const scroller = el.closest<HTMLElement>(".scroll-quiet");
      const px = Math.round(el.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top + (scroller?.scrollTop ?? 0) + STOP_GAP);
      sheet.style.setProperty("--sheet-stop", `${px}px`);
      sheet.dataset.stop = "";
      setStop(px);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    /**
     * **머리글도 지켜본다** (S15P21A405-714). 1 단은 머리글 높이를 접는다(`globals.css`). 1 단으로 열린 시트(여정,
     * S15P21A405-712)는 머리글이 접힌 채로 재서, 2 단으로 올리면 머리글만큼 짧게 멈췄다 — 360 × 780 에서 175px 로
     * 멈춰 재생 줄이 플레이어 바 밑에 반쯤 깔렸다(실측, 다시 재면 208px). 머리글이 펴져 요소가 내려가도 요소 크기는
     * 그대로라 요소만 봐서는 다시 재지 않는다. 머리글 높이가 바뀔 때마다 다시 잰다
     */
    const header = sheet.querySelector<HTMLElement>(":scope > section > header");
    if (header) ro.observe(header);
    return () => {
      ro.disconnect();
      sheet.style.removeProperty("--sheet-stop");
      delete sheet.dataset.stop;
      setStop(null);
    };
  }, [ref]);
}
