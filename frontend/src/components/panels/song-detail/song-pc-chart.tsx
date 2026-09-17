"use client";

import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from "chart.js";
import { useEffect, useRef } from "react";
import { FONTS, PALETTE } from "@/constants/design-tokens";

/**
 * 쓰는 조각만 등록한다 — chart.js 는 등록한 것만 번들에 남는다. 막대 하나 그리자고
 * 선·도넛·레이더 컨트롤러까지 지고 갈 이유가 없다.
 */
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export interface PcRow {
  axis: number;
  /** 축의 왼쪽(음수 쪽) 말 */
  left: string;
  /** 축의 오른쪽(양수 쪽) 말 */
  right: string;
  /** 표준편차 배수. 음수면 왼쪽, 양수면 오른쪽으로 치우쳤다 */
  sd: number;
}

/** 축 끝. 이보다 더 치우친 곡은 드물어서 막대가 꽉 찬 것으로 본다 */
const FULL_SD = 3;
/** 막대 두께와 줄 간격(px). 축 눈금 자리를 더해 캔버스 높이를 낸다 */
const BAR = 13;
const ROW = 29;

/**
 * 고정 주성분 상위 다섯 — **한 줄이 축 하나** (S15P21A405-384, 355).
 *
 * 줄마다 **양쪽 말을 다 적는다.** 왼쪽 끝에 음수 쪽 말, 오른쪽 끝에 양수 쪽 말을 두고 막대가
 * 이 곡의 쪽으로 뻗는다. 이 곡이 선 쪽은 또렷하게, 반대쪽은 작고 흐리게 — 그래서 한 줄만
 * 봐도 **"무엇 대 무엇 중 어느 쪽, 얼마나"** 가 읽힌다.
 *
 * 한쪽 말만 적던 때가 문제였다. `밝고 거친` 은 그 자체로 축의 한쪽 이름이라, 단어가 이미
 * 방향을 말하는데 막대가 방향을 한 번 더 말했다 — 한 줄에 같은 소리가 두 번 얹혀 안 읽혔다.
 * 반대쪽 말을 같이 놓으면 그 방향이 **축 위의 위치**로 바뀐다.
 *
 * **쪽은 `sd` 부호 하나로 정한다.** 예전에는 말은 원값 부호로 고르고 막대는 편차로 그려서,
 * 둘이 어긋날 수 있었다(이 겹 평균이 0 에서 멀면). 이제 길이·방향·또렷한 쪽·정렬이 전부
 * 같은 수에서 나온다 — "이 겹의 다른 곡들에 견줘 어느 쪽으로 얼마나" 가 이 그림의 뜻이다.
 */
export default function SongPcChart({ rows }: { rows: PcRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * `rows` 는 **부모가 `useMemo` 로 붙잡아 준 배열**이어야 한다 (`song-pc-list`). 렌더마다
   * 새 배열이 오면 차트를 부수고 다시 짓게 되어 **애니메이션이 계속 처음부터 다시 돈다.**
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = rows;
    /** 이 곡이 선 쪽인가 — 또렷하게 적을 쪽을 고른다 */
    const on = (i: number, side: "left" | "right") => (side === "right" ? data[i].sd >= 0 : data[i].sd < 0);
    /** 이 곡의 쪽은 또렷하고 크게, 반대쪽은 작고 흐리게 */
    const tickColor = (side: "left" | "right") => (ctx: { index: number }) => (on(ctx.index, side) ? PALETTE.ink2 : PALETTE.ink4);
    const tickFont = (side: "left" | "right") => (ctx: { index: number }) => ({ family: FONTS.body, size: on(ctx.index, side) ? 11 : 9.5 });

    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map((r) => r.left),
        datasets: [
          {
            data: data.map((r) => Math.max(-FULL_SD, Math.min(FULL_SD, r.sd))),
            backgroundColor: data.map((r) => (r.sd >= 0 ? PALETTE.teal : PALETTE.violet)),
            borderRadius: 3,
            barThickness: BAR,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 720, easing: "easeOutQuart" },
        scales: {
          x: {
            min: -FULL_SD,
            max: FULL_SD,
            border: { display: false },
            // 0 선만 또렷하게 — 막대가 어디서 출발하는지가 이 그림의 기준이다
            grid: { color: (ctx) => (ctx.tick.value === 0 ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.05)"), tickLength: 0 },
            ticks: { stepSize: FULL_SD, color: PALETTE.ink4, font: { family: FONTS.mono, size: 9 }, padding: 3, callback: (v) => `${v}σ` },
          },
          // 왼쪽 눈금 = 음수 쪽 말
          y: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: tickColor("left"), font: tickFont("left"), crossAlign: "far", padding: 4 },
          },
          // 오른쪽 눈금 = 양수 쪽 말. 같은 칸을 쓰되 라벨만 갈아 끼운다
          y1: {
            position: "right",
            border: { display: false },
            grid: { display: false },
            ticks: {
              color: tickColor("right"),
              font: tickFont("right"),
              crossAlign: "near",
              padding: 4,
              callback: (_v, i) => data[i].right,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: "rgba(10,14,26,.92)",
            borderColor: "rgba(255,255,255,.13)",
            borderWidth: 1,
            titleFont: { family: FONTS.body, size: 10.5 },
            bodyFont: { family: FONTS.mono, size: 10 },
            padding: 8,
            callbacks: {
              title: (items) => {
                const r = data[items[0].dataIndex];
                return r.sd >= 0 ? r.right : r.left;
              },
              label: (item) => {
                const r = data[item.dataIndex];
                return `${Math.abs(r.sd).toFixed(1)}σ · PC${r.axis + 1}`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [rows]);

  // 눈금 줄 자리(20px)를 더한다. 캔버스는 부모 높이를 따르므로 여기서 한 번만 잰다
  return (
    <div style={{ height: rows.length * ROW + 20 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
