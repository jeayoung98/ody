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
  label: string;
  /** 표준편차 배수. 음수면 축의 반대쪽으로 치우쳤다는 뜻이다 */
  sd: number;
}

/** 축 끝. 이보다 더 치우친 곡은 드물어서 막대가 꽉 찬 것으로 본다 */
const FULL_SD = 3;
/** 막대 두께와 줄 간격(px). 축 눈금 자리를 더해 캔버스 높이를 낸다 */
const BAR = 13;
const ROW = 27;

/**
 * 고정 주성분 상위 다섯 개 — **0 을 가운데 둔 가로 막대** (S15P21A405-384, 355).
 *
 * 치우침에는 방향이 있다. 예전 진행바는 0~100% 로 폈는데, 그러면 "+2.4σ 로 크게 치우친 곡"
 * 과 "-2.4σ 로 반대로 치우친 곡" 이 양 끝에 서서 **무엇이 센지**가 아니라 **어느 쪽인지**만
 * 보였다. 0 을 가운데 놓으면 길이가 세기, 방향이 쪽을 말한다 — 읽는 법이 하나로 준다.
 *
 * 오른쪽(+)은 teal, 왼쪽(−)은 violet. 여정 출발·도착과 같은 짝이라 "양쪽" 을 뜻하는 색을
 * 앱 안에서 한 벌로 쓴다.
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

    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map((r) => r.label),
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
        layout: { padding: { right: 2 } },
        scales: {
          x: {
            min: -FULL_SD,
            max: FULL_SD,
            border: { display: false },
            // 0 선만 또렷하게 — 막대가 어디서 출발하는지가 이 그림의 기준이다
            grid: { color: (ctx) => (ctx.tick.value === 0 ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.05)"), tickLength: 0 },
            ticks: { stepSize: FULL_SD, color: PALETTE.ink4, font: { family: FONTS.mono, size: 9 }, padding: 4, callback: (v) => `${v}σ` },
          },
          y: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: PALETTE.ink2, font: { family: FONTS.body, size: 11 }, crossAlign: "far", padding: 6 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: "rgba(10,14,26,.92)",
            borderColor: "rgba(255,255,255,.13)",
            borderWidth: 1,
            titleFont: { family: FONTS.body, size: 11 },
            bodyFont: { family: FONTS.mono, size: 11 },
            padding: 8,
            callbacks: {
              label: (item) => {
                const sd = data[item.dataIndex].sd;
                return `${sd > 0 ? "+" : ""}${sd.toFixed(1)}σ · PC${data[item.dataIndex].axis + 1}`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [rows]);

  // 눈금 줄 자리(22px)를 더한다. 캔버스는 부모 높이를 따르므로 여기서 한 번만 잰다
  return (
    <div style={{ height: rows.length * ROW + 22 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
