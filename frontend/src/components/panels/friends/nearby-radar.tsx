"use client";

import HelmetAvatar from "@/components/common/helmet-avatar";
import { RADAR, emojiOf } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { layerPointOf } from "@/lib/layer-point";
import type { Point } from "@/lib/nearby-from-layer";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useReactionStore } from "@/stores/use-reaction-store";
import type { NearbyPerson } from "@/types";

/**
 * 주변 사람 레이더 (S15P21A405-496, SOCIAL-01).
 *
 * 가운데가 나고, 주변에 사람들이 헬멧으로 놓인다.
 *
 * **이제 각도도 진짜다** (S15P21A405-582). 예전에는 `NearbyPerson` 에 좌표가 없어서 방향을
 * 만들 근거가 없었고, 그래서 사람들을 고르게 나눠 두기만 했다. 5차에서 서버가 층 좌표를 실어
 * 주면서 방향이 생겼다 — 반지름은 내 자리에서의 거리, 각도는 그쪽 방향이다.
 *
 * **층의 미니맵은 아니다** (S15P21A405-596). 층에 있는 사람을 다 그리는 판이 아니라 **가까운
 * 열두 명을 둘레에 벌려 놓는** 판이다. 그래서 같은 곡을 듣는 사람이 한 점에 포개지면 그대로
 * 두지 않고 밀어낸다 (`spreadApart`) — 판의 목적이 "누를 수 있게 보여 주는 것" 이라서다.
 *
 * 자리를 모르는 사람만 예전 방식(`angleOf`)으로 흩어 둔다.
 */

/** 자리를 모르는 사람을 둘 곳. 고르게 나누고 위(12시)부터 시계방향으로 */
export const angleOf = (i: number, total: number) => (i / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;

/**
 * 내 자리에서 그 사람 쪽을 바라보는 각 (S15P21A405-582). 자리를 모르면 `null`.
 *
 * 화면은 y 가 아래로 자라고 층 좌표는 위로 자란다. 그래서 y 를 뒤집어야 지도에서 위쪽에 있는
 * 사람이 레이더에서도 위에 온다 — `angleOf` 의 12시 기준과 같은 방향이다.
 *
 * **같은 곡을 듣는 사람은 각도도 반지름도 같아진다.** 그대로 두면 완전히 포개지므로
 * `spreadApart` 가 떼어 놓는다.
 */
export function bearingOf(me: Point | null, at: Point | null): number | null {
  if (!me || !at) return null;
  return Math.atan2(-(at.y - me.y), at.x - me.x);
}

/** 겹친 헬멧 사이에 남길 틈(px). 0 이면 테두리가 맞닿아 두 개인지 하나인지 안 보인다 */
const SPREAD_GAP = 3;
/** 밀어내기 반복 횟수. 12명에 이 정도면 남는 겹침이 없다 (`tests/nearby-radar.test.cjs`) */
const SPREAD_PASSES = 8;

/**
 * **겹친 헬멧을 밀어낸다** (S15P21A405-596).
 *
 * 각도를 좌표로 잡으면 **같은 곡을 듣는 사람은 각도도 반지름도 같아 완전히 포개진다.** 맨 위
 * 한 명만 눌리고 나머지는 있는지도 모른다 — 레이더에서 사람을 누르는 것이 프로필로 가는 길이라
 * 그냥 안 보이는 것보다 나쁘다.
 *
 * 그래서 방향은 좌표대로 두되, 닿는 짝만 서로 반대로 조금씩 민다. 몇 번 반복하면 자리가 잡힌다.
 *
 * **무작위를 쓰지 않는다.** 완전히 같은 자리에 겹친 짝은 밀어낼 방향이 없는데, 거기서 난수를
 * 쓰면 다시 그릴 때마다 헬멧이 튄다. 대신 **차례 번호로 방향을 정해** 같은 입력이면 같은
 * 그림이 나오게 한다.
 */
export function spreadApart(items: readonly { x: number; y: number; d: number }[], bound: number): { x: number; y: number }[] {
  const out = items.map((it) => ({ x: it.x, y: it.y }));

  /**
   * **똑같은 자리부터 부채꼴로 편다.** 같은 곡을 듣는 사람이 흔해서 한 점에 여럿이 겹치는데,
   * 그 상태로 아래 밀어내기만 돌리면 서로 반대로 밀다가 다시 부딪히기를 되풀이한다 — 열두 명이
   * 한 점이면 여덟 번을 돌려도 안 풀렸다.
   *
   * 먼저 원 위에 고르게 놓아 두면 남는 겹침은 이웃 무리와의 경계뿐이고, 그건 몇 번이면 풀린다.
   */
  const groups = new Map<string, number[]>();
  out.forEach((p, i) => {
    const key = `${Math.round(p.x)},${Math.round(p.y)}`;
    const at = groups.get(key);
    if (at) at.push(i);
    else groups.set(key, [i]);
  });
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const need = Math.max(...idx.map((i) => items[i].d)) + SPREAD_GAP;
    // 이웃끼리 `need` 만큼 벌어지는 원의 반지름
    const r0 = need / (2 * Math.sin(Math.PI / idx.length));
    idx.forEach((i, k) => {
      const a = (k / idx.length) * Math.PI * 2 - Math.PI / 2;
      out[i] = { x: out[i].x + Math.cos(a) * r0, y: out[i].y + Math.sin(a) * r0 };
    });
  }

  for (let pass = 0; pass < SPREAD_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const need = (items[i].d + items[j].d) / 2 + SPREAD_GAP;
        let dx = out[j].x - out[i].x;
        let dy = out[j].y - out[i].y;
        let dist = Math.hypot(dx, dy);
        if (dist >= need) continue;
        if (dist < 1e-6) {
          // 부채꼴을 펴고도 겹쳤다. 차례 번호로 방향을 갈라 매번 같은 그림이 나오게 한다
          const a = ((i * 2 + j) * Math.PI * 2) / Math.max(1, out.length * 2);
          dx = Math.cos(a);
          dy = Math.sin(a);
          dist = 1;
        }
        const push = (need - dist) / 2 / dist;
        out[i].x -= dx * push;
        out[i].y -= dy * push;
        out[j].x += dx * push;
        out[j].y += dy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // 밀다 보면 판 밖으로 나간다. 테두리 안에 붙여 둔다 — 잘려 나가면 누를 수가 없다
  return out.map((p, i) => {
    const max = Math.max(0, bound - items[i].d / 2);
    const dist = Math.hypot(p.x, p.y);
    if (dist <= max || dist < 1e-6) return p;
    const k = max / dist;
    return { x: p.x * k, y: p.y * k };
  });
}

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
 * `riderCount` 는 아직 레이더에 안 그린다. 값 자체는 실값이 됐지만(S15P21A405-530) 헬멧 크기가
 * 이미 만남 횟수를 나타내고 있어서, 같은 도형에 두 가지 뜻을 얹으면 둘 다 안 읽힌다.
 * 동승 표시는 지도 쪽(`draw-friends`)이 우주선 줄로 맡는다.
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
  // 반응 이모지는 **여기에만** 뜬다 (S15P21A405-608). 지도 위 오버레이는 걷어냈다 — 지도가 어수선해진다
  const floating = useReactionStore((s) => s.floating);
  // 내 헬멧 색도 내가 듣는 곡의 장르를 따라간다 — 지도의 내 표식과 같은 규칙이다
  const myMusicId = useMapStore((s) => s.myMusicId);
  const layer = useMapStore((s) => s.layer);
  // 각도의 기준점. 아직 아무 곡도 안 틀었으면 없고, 그때는 예전처럼 고르게 흩어 둔다
  const me0 = layerPointOf(myMusicId, layer);

  // 빈 배열이면 Math.max 가 -Infinity 라 0 을 함께 넣는다
  const maxDistance = Math.max(...people.map((p) => p.distance).filter(Number.isFinite), 0);
  const maxMeeting = Math.max(...people.map((p) => p.meetingCount), 0);
  const R = RADAR.size / 2;

  /**
   * 자리를 먼저 다 잡고 그린다. **밀어내기가 짝을 봐야 해서** 한 명씩 그리며 정할 수 없다.
   * 열두 명짜리 배열이라 매 렌더 돌려도 값이 싸다.
   */
  const sizes = people.map((p) => sizeOf(p.meetingCount, maxMeeting));
  const spots = spreadApart(
    people.map((p, i) => {
      const at = p.x != null && p.y != null ? { x: p.x, y: p.y } : layerPointOf(p.musicId, layer);
      const a = bearingOf(me0, at) ?? angleOf(i, people.length);
      const r = radiusOf(p.distance, maxDistance) * R;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, d: sizes[i] };
    }),
    R,
  );

  return (
    <div className="relative mx-auto" style={{ width: RADAR.size, height: RADAR.size }} aria-label="주변 사람 레이더">
      {/* 눈금. 거리를 가늠하는 용도라 숫자는 붙이지 않는다 — distance 의 단위가 사람에게 뜻이 없다 */}
      <svg width={RADAR.size} height={RADAR.size} className="absolute inset-0" aria-hidden>
        {[1, 0.66, 0.33].map((k) => (
          <circle key={k} cx={R} cy={R} r={R * k * 0.92} fill="none" stroke="currentColor" className="text-line" />
        ))}
      </svg>

      {/*
        탐색 빛 (S15P21A405-510). 눈금 위, 사람 아래다 — 사람을 덮으면 읽는 것을 방해한다.
        **지나가는 자리의 사람을 밝히지 않는다.** 각도가 진짜가 된 지금도 마찬가지다
        (S15P21A405-582) — 빛이 도는 속도와 사람이 있는 자리는 아무 관계가 없어서, 밝히면
        "지금 저 사람을 찾았다" 는 없는 뜻이 생긴다. 분위기만 맡는다.
      */}
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <span
          className="animate-radar-sweep rounded-pill"
          style={{
            width: RADAR.size * 0.92,
            height: RADAR.size * 0.92,
            background: "conic-gradient(from 0deg, rgb(79 227 206 / 0.20), rgb(79 227 206 / 0.05) 22deg, transparent 58deg)",
          }}
        />
      </span>

      {/*
        가운데는 나 (S15P21A405-506). 예전에는 `나` 라는 글자 한 자였는데, 둘레의 사람은 전부
        프로필 사진이라 **나만 다른 종류로 읽혔다.** 둘레와 같은 것을 쓴다 — 지금은 우주복
        헬멧이다 (S15P21A405-536). 둘레가 전부 헬멧인데 나만 맨 얼굴이면 같은 문제가 돌아온다.

        **글자 라벨은 붙이지 않는다.** 잠깐 `나` 를 아래에 달았다가 뺐다 — 가운데라는 자리와
        테두리가 이미 "이게 너" 라고 말하고 있어서, 판 한가운데의 글자는 설명이 아니라 얼룩이었다.

        숨쉬기는 둘레 사람보다 세게 준다(`--breathe-hi`). 하나뿐이고 옆에 부딪힐 것이 없어서
        화면이 출렁이지 않는다.
      */}
      {/*
        **판을 덮는 격자로 가운데를 잡는다** (S15P21A405-510). 예전에는 `top-1/2 left-1/2` 에
        `-translate-1/2` 를 걸었는데, 그 방식은 요소의 실측 크기에 의존해서 안쪽이 inline 성격이면
        줄 박스만큼 어긋난다. 격자 가운데는 자식이 어떤 크기든 눈금 원의 중심과 같은 자리다.

        자리잡기와 숨쉬기는 계속 다른 요소다 — 한 요소에 얹으면 키프레임의 `transform: scale()`
        이 정렬을 덮어쓴다.
      */}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <span
          className="animate-breathe grid place-items-center rounded-pill p-[3px] shadow-[0_0_18px_-2px_rgba(79,227,206,.8)] ring-2 ring-teal/80"
          style={{ ["--breathe-hi" as string]: 1.12, animationDuration: "1.9s" }}
        >
          <HelmetAvatar email={me?.email ?? "me"} imageUrl={me?.imageUrl} musicId={myMusicId} size={44} />
        </span>
      </span>

      {people.map((p, i) => {
        const d = sizes[i];
        const spot = spots[i];
        // 자주 마주친 사람만 숨쉰다. 전부 뛰면 화면이 출렁이고 "크다" 는 신호도 사라진다
        const breathes = maxMeeting > 0 && p.meetingCount >= maxMeeting * RADAR.breatheFrom;
        return (
          <button
            key={p.email}
            type="button"
            onClick={() => openFeed(p.email)}
            title={`${p.nickname ?? "이름 없음"}${p.meetingCount > 0 ? ` · ${p.meetingCount}번 마주침` : ""}`}
            className={`absolute grid place-items-center rounded-pill transition-opacity hover:opacity-80 ${breathes ? "animate-breathe" : ""}`}
            style={{
              width: d,
              height: d,
              left: R + spot.x,
              top: R + spot.y,
              marginLeft: -d / 2,
              marginTop: -d / 2,
              // 주기를 사람마다 달리 줘 심장박동처럼 맞아떨어지지 않게 한다
              animationDuration: breathes ? `${2.2 + (i % 5) * 0.35}s` : undefined,
            }}
          >
            {/*
              **지도에 찍히는 그 우주복 헬멧 그대로다** (S15P21A405-536). 예전에는 동그란 사진에
              가짜 바이저 띠를 얹어 "헬멧처럼" 보이게 했는데, 지도의 진짜 헬멧과 닮지 않아서
              레이더에서 본 사람을 지도에서 찾을 때 도움이 안 됐다. 사진은 바이저 안에 들어간다.
            */}
            <HelmetAvatar email={p.email} imageUrl={p.imageUrl} musicId={p.musicId} size={d} online />
          </button>
        );
      })}

      {/*
        반응 이모지 (SOCIAL-02, S15P21A405-608). 내 것은 가운데(나) 위로, 남의 것은 그 사람 헬멧 위로
        떠오른다 — 지도의 `FloatingReactionItem` 과 같은 연출(`animate-fly`)이다. 목록에 없는 사람의
        반응은 자리를 모르니 그리지 않는다.
      */}
      {floating.map((r) => {
        const i = r.mine ? -1 : people.findIndex((p) => p.email === r.fromEmail);
        if (!r.mine && i < 0) return null;
        const at = r.mine ? { x: 0, y: -22 } : { x: spots[i].x, y: spots[i].y - sizes[i] / 2 };
        return (
          <span key={r.id} aria-hidden className="pointer-events-none absolute z-10" style={{ left: R + at.x, top: R + at.y }}>
            <span className="animate-fly absolute bottom-0 left-0 text-[26px] leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]">
              {emojiOf(r.reactionKey)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
