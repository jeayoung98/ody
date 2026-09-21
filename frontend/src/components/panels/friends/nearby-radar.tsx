"use client";

import Avatar from "@/components/common/avatar";
import { RADAR } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { usePanelStore } from "@/stores/use-panel-store";
import type { NearbyPerson } from "@/types";

/**
 * 주변 사람 레이더 (S15P21A405-496, SOCIAL-01).
 *
 * 가운데가 나고, 주변에 사람들이 헬멧으로 놓인다.
 *
 * **반지름만 진짜다.** `distance`(내 곡과의 거리)를 쓴다 — 멀수록 바깥이다. **각도는 의미가
 * 없다.** `NearbyPerson` 에 좌표가 오지 않아서(명세 §6.1) 방향을 만들 근거가 없다. 그래서
 * 해시 같은 것으로 흩뿌리지 않고 **고르게 나눠** 둔다 — 겹치지 않게 하는 것이 목적이고, 고른
 * 배치는 적어도 "이 방향에 뭔가 있다" 는 오해를 덜 만든다.
 *
 * 좌표가 생기면 `angleOf` 만 바꾸면 된다.
 */

/** 이 사람을 몇 시 방향에 둘지. 고르게 나누고 위(12시)부터 시계방향으로 */
export const angleOf = (i: number, total: number) => (i / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;

/**
 * 가운데에서 얼마나 떨어뜨릴지 (0~1).
 *
 * **목록 안의 최대 거리로 정규화한다.** `distance` 의 절대 범위를 프론트가 모르기 때문이다 —
 * 고정 배율로 두면 전부 가운데 뭉치거나 전부 테두리에 붙는다. 대신 사람이 들고 날 때 반지름이
 * 조금 움직이는데, 순서(가까운 순)는 유지되므로 읽는 데는 문제가 없다.
 */
export function radiusOf(distance: number, max: number): number {
  if (!(max > 0)) return RADAR.ringMin;
  const t = Math.min(1, Math.max(0, distance / max));
  return RADAR.ringMin + t * (RADAR.ringMax - RADAR.ringMin);
}

/**
 * 헬멧 지름. **자주 마주친 사람이 크다.**
 *
 * `meetingCount` 를 목록 최대값으로 정규화한다. **전부 0 이거나 전부 같으면 모두 기본 크기**다 —
 * 서버 집계가 아직 협의 전이라(BACKEND-NOTES S-5) 값이 안 올 수 있는데, 그때 크기를 억지로
 * 벌리면 없는 차이를 지어내는 것이 된다.
 *
 * `riderCount` 는 쓰지 않았다. 따라가기가 미구현이라 **항상 0** 이다.
 */
export function sizeOf(meetingCount: number, max: number): number {
  if (!(max > 0)) return RADAR.sizeMin;
  const t = Math.min(1, Math.max(0, meetingCount / max));
  return Math.round(RADAR.sizeMin + t * (RADAR.sizeMax - RADAR.sizeMin));
}

/**
 * **아무도 없어도 판은 그린다.** 사람이 0명일 때 통째로 감추면 패널에 빈 공간만 남아 무엇을
 * 보는 화면인지 알 수 없다. 눈금과 가운데의 나를 두면 "여기가 나고, 지금은 주변이 비었다" 가
 * 그 자체로 읽힌다 (S15P21A405-496).
 */
export default function NearbyRadar({ people }: { people: NearbyPerson[] }) {
  const openFeed = usePanelStore((s) => s.openFeed);
  const { data: me } = useMeQuery();

  // 빈 배열이면 Math.max 가 -Infinity 라 0 을 함께 넣는다
  const maxDistance = Math.max(...people.map((p) => p.distance).filter(Number.isFinite), 0);
  const maxMeeting = Math.max(...people.map((p) => p.meetingCount), 0);
  const R = RADAR.size / 2;

  return (
    <div className="relative mx-auto" style={{ width: RADAR.size, height: RADAR.size }} aria-label="주변 사람 레이더">
      {/* 눈금. 거리를 가늠하는 용도라 숫자는 붙이지 않는다 — distance 의 단위가 사람에게 뜻이 없다 */}
      <svg width={RADAR.size} height={RADAR.size} className="absolute inset-0" aria-hidden>
        {[1, 0.66, 0.33].map((k) => (
          <circle key={k} cx={R} cy={R} r={R * k * 0.92} fill="none" stroke="currentColor" className="text-line" />
        ))}
      </svg>

      {/*
        가운데는 나 (S15P21A405-506). 예전에는 `나` 라는 글자 한 자였는데, 둘레의 사람은 전부
        프로필 사진이라 **나만 다른 종류로 읽혔다.** 같은 Avatar 를 쓰고 `나` 는 아래 라벨로 뺀다 —
        사진만 두면 내 사진을 외우지 못한 사람이 "가운데가 누구지" 를 묻게 된다.

        숨쉬기는 둘레 사람보다 세게 준다(`--breathe-hi`). 하나뿐이고 옆에 부딪힐 것이 없어서
        화면이 출렁이지 않는다 — 여기서는 "이게 너야" 를 짚는 것이 일이다.
      */}
      {/* 사진은 판의 정중앙이다 — 반지름이 여기서부터 재지므로 라벨 몫으로 밀면 안 된다 */}
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span
          className="animate-breathe grid place-items-center rounded-pill p-[3px] shadow-[0_0_18px_-2px_rgba(79,227,206,.8)] ring-2 ring-teal/80"
          style={{ ["--breathe-hi" as string]: 1.12, animationDuration: "1.9s" }}
        >
          <Avatar src={me?.imageUrl} name={me?.nickname ?? me?.name} size={40} />
        </span>
        <span className="lbl absolute top-full left-1/2 mt-1 -translate-x-1/2">나</span>
      </span>

      {people.map((p, i) => {
        const a = angleOf(i, people.length);
        const d = sizeOf(p.meetingCount, maxMeeting);
        const r = radiusOf(p.distance, maxDistance) * R;
        // 자주 마주친 사람만 숨쉰다. 전부 뛰면 화면이 출렁이고 "크다" 는 신호도 사라진다
        const breathes = maxMeeting > 0 && p.meetingCount >= maxMeeting * RADAR.breatheFrom;
        return (
          <button
            key={p.email}
            type="button"
            onClick={() => openFeed(p.email)}
            title={`${p.nickname ?? "이름 없음"}${p.meetingCount > 0 ? ` · ${p.meetingCount}번 마주침` : ""}`}
            className={`absolute grid place-items-center rounded-pill border border-teal/70 bg-void-3 transition-colors hover:border-teal ${breathes ? "animate-breathe" : ""}`}
            style={{
              width: d,
              height: d,
              left: R + Math.cos(a) * r,
              top: R + Math.sin(a) * r,
              marginLeft: -d / 2,
              marginTop: -d / 2,
              // 주기를 사람마다 달리 줘 심장박동처럼 맞아떨어지지 않게 한다
              animationDuration: breathes ? `${2.2 + (i % 5) * 0.35}s` : undefined,
            }}
          >
            <Avatar src={p.imageUrl} name={p.nickname} size={d - 6} />
            {/* 헬멧 바이저 — 지도 위 우주인과 같은 물건으로 읽히게 하는 표시다 */}
            <span aria-hidden className="pointer-events-none absolute top-[22%] right-[12%] left-[12%] h-[26%] rounded-pill bg-teal/15 ring-1 ring-teal/30" />
          </button>
        );
      })}
    </div>
  );
}
