"use client";

import { useEffect, type RefObject } from "react";
import { SHEET_HEAD_PX } from "@/constants/design-tokens";
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
 * **본문 윗끝에서 잰다** (S15P21A405-714) — `use-sheet-peek` 과 같은 방식이다. 1 단은 머리글을 접는데
 * (`globals.css`), 시트 윗끝에서 재면 머리글 상태에 따라 값이 달라진다. 1 단으로 열린 여정 시트(S15P21A405-712)가
 * 접힌 채로 재서 2 단이 머리글만큼 짧게 멈췄다(360 × 780 에서 175px, 필요한 값 208px, 실측). 머리글을 따로 지켜보며
 * 다시 재게 했더니 머리글이 펴지는 동안 매 프레임 값이 바뀌어 지도가 따라 떨렸다(사용자 보고) — 그 방식은 걷어냈다.
 * 본문 안의 거리는 머리글이 접히든 펴지든 그대로이고, 2 단의 머리글 몫은 고정값이다(`SHEET_HEAD_PX`).
 *
 * 시트 요소(`[data-sheet]`)에 `--sheet-stop` 과 `data-stop` 을 심으면 `globals.css` 가 2 단 자리를
 * 그 값으로 바꾼다. 같은 값을 스토어에도 넣어 지도 가림폭이 읽게 한다.
 * 시트 안이 아니면(넓은 화면의 우측 패널) 아무것도 하지 않는다 — 거기에는 단이 없다.
 */
export function useSheetStop(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const sheet = el?.closest<HTMLElement>("[data-sheet]");
    const body = el?.closest<HTMLElement>("[data-sheet-body]");
    if (!el || !sheet || !body) return;
    const setStop = usePanelStore.getState().setSheetStop;

    const measure = () => {
      // 본문 위 여백은 단마다 달라서 뺀다. 3 단에서 굴려 둔 채 내려오면 요소가 그만큼 위에 있으니 스크롤 양을 되돌려 더한다
      const inBody = el.getBoundingClientRect().bottom - body.getBoundingClientRect().top - parseFloat(getComputedStyle(body).paddingTop) + body.scrollTop;
      const px = Math.round(SHEET_HEAD_PX + inBody + STOP_GAP);
      sheet.style.setProperty("--sheet-stop", `${px}px`);
      sheet.dataset.stop = "";
      setStop(px);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      sheet.style.removeProperty("--sheet-stop");
      delete sheet.dataset.stop;
      setStop(null);
    };
  }, [ref]);
}
