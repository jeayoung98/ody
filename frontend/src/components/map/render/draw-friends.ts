import { FRIEND_MARKER } from "@/constants";
import { FONTS, genreRgb, rgba } from "@/constants/design-tokens";
import type { NearbyUser } from "@/types";
import type { MapEngine } from "../engine/map-engine";
import { drawCropped, photoFor } from "@/lib/avatar-photo";
import { avatarFor, ME_AVATAR, trailOf } from "./sprites";

const TEAL: readonly [number, number, number] = [79, 227, 206];

/**
 * 프로필을 바이저(유리창) 안에 넣은 우주 헬멧.
 *
 * **패널에서도 쓴다** (S15P21A405-536) — `common/helmet-avatar`. 지도와 목록이 같은 사람을
 * 다른 그림으로 보여 주면 목록에서 본 사람을 지도에서 못 찾는다. 베껴 두면 한쪽만 바뀐다.
 */
export function drawVisor(g: CanvasRenderingContext2D, px: number, py: number, R: number, u: NearbyUser) {
  const fade = g.globalAlpha;
  g.save();
  g.beginPath();
  g.arc(px, py, R, 0, 6.284);
  g.clip();
  /**
   * **프로필 사진이 있으면 그것이 바이저 안에 들어간다** (S15P21A405-536). 없거나 아직
   * 안 받아졌으면 절차적 그림이다 — 기다리느라 빈 헬멧을 그리지 않는다.
   */
  const photo = photoFor(u.imageUrl);
  if (photo) drawCropped(g, photo, px - R, py - R, R * 2);
  else g.drawImage(avatarFor(u), px - R, py - R, R * 2, R * 2);
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.3 * fade;
  g.fillStyle = "#dfeaff";
  g.beginPath();
  g.ellipse(px - R * 0.34, py - R * 0.42, R * 0.66, R * 0.34, -0.7, 0, 6.284);
  g.fill();
  g.restore();
  g.beginPath();
  g.arc(px, py, R, 0, 6.284);
  g.strokeStyle = "rgba(10,16,30,.85)";
  g.lineWidth = 2;
  g.stroke();
}

/** 헬멧 테두리와 좌우 통신 포드. `drawVisor` 와 짝이다 — 패널도 이 둘을 같이 부른다 */
export function drawHelmet(g: CanvasRenderingContext2D, px: number, py: number, R: number, rgb: readonly [number, number, number], hot: boolean) {
  g.beginPath();
  g.arc(px, py, R * 1.3, 0, 6.284);
  g.fillStyle = "rgba(186,206,240,.13)";
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = hot ? rgba(rgb, 0.9) : "rgba(212,229,255,.5)";
  g.stroke();
  // 좌우 통신 포드
  g.fillStyle = "rgba(196,214,245,.32)";
  const pw = R * 0.36;
  const ph = R * 0.62;
  g.beginPath();
  g.roundRect(px - R * 1.52, py - ph / 2, pw, ph, pw * 0.45);
  g.fill();
  g.beginPath();
  g.roundRect(px + R * 1.16, py - ph / 2, pw, ph, pw * 0.45);
  g.fill();
  g.strokeStyle = "rgba(230,242,255,.35)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(px, py, R * 1.16, -2.5, -0.9);
  g.stroke();
}

/**
 * 동승자가 있으면 헬멧이 우주선이 된다 (기수는 진행 방향).
 *
 * **평면 아이콘식 로켓** (S15P21A405-624). 둥근 코에서 꼬리로 좁아지는 물방울 몸통(두 톤),
 * 큰 창, 뒤로 뻗은 둥근 지느러미 두 개, 꼬리 밴드, **꼬리 불꽃**. 색은 서비스 팔레트:
 * 몸통 ink, 창 테 ink4, 유리 violet, 지느러미 teal, 꼬리 밴드 violet, 불꽃 teal.
 *
 * **불꽃을 되살렸다** (요청, 2026-09-25). 624 에서 뺀 적이 있는데, 그때 뺀 것은 **뾰족한 삼각
 * 로켓에 달린 각진 불꽃**이라 차가워 보였기 때문이다. 지금 몸통은 둥근 물방울이라 같은 이유가
 * 그대로 적용되지 않는다 — 모서리 없는 물방울 두 겹으로 그리고, 꼬리 밴드 밑에서 시작해
 * 배와 이어지게 둔다. 배가 서 있는 동안에도 흔들려서 "가고 있다" 가 읽힌다.
 *
 * **파비콘(`src/app/icon.svg`)에는 안 넣는다.** 그쪽은 16px 로도 읽혀야 하는 정지 그림이라
 * 꼬리에 뭘 더하면 뭉갠다. 몸통·지느러미·밴드까지만 같게 둔다.
 *
 * **지느러미는 누구 것이든 teal 이다** (S15P21A405-641). 예전에는 그 사람의 장르색을 따랐는데,
 * 실데이터는 장르가 붙은 곡이 1% 뿐이라(`constants/map.ts` 의 `NO_GENRE_ID`) 거의 모든 배가
 * 같은 무장르색이었다 — 구분이 되지도 않으면서 인자만 하나 더 받고 있었다. 장르색이 실제로
 * 갈리는 자리는 헬멧(동승자 없는 사람)이고 그쪽은 그대로다.
 *
 * **창이 원점이다.** 부르는 쪽이 그 위에 `drawVisor(…, R * 0.72)` 로 사진을 얹으므로 창 중심이
 * `(px, py)` 여야 한다. 그래서 몸통은 원점보다 아래로 더 길다(코 -1.25R, 꼬리 1.75R).
 * 파비콘(`src/app/icon.svg`)이 이 좌표를 그대로 옮긴다 — 둘을 같이 고친다.
 */
export function drawShip(g: CanvasRenderingContext2D, px: number, py: number, R: number, ang: number, t: number) {
  g.save();
  g.translate(px, py);
  g.rotate(ang);

  /**
   * 꼬리 불꽃. **제일 먼저 그린다** — 몸통·지느러미 뒤로 깔려야 꼬리에서 뿜는 것으로 보인다.
   * 나중에 그리면 밴드 위를 덮어 배에 얹힌 딱지가 된다.
   *
   * 흔들림에 `px` 를 섞는 이유: 선단에 배가 여럿일 때 같은 위상으로 뛰면 한 몸처럼 보인다.
   * 자리마다 위상이 달라야 각자 나아가는 것으로 읽힌다.
   */
  const flicker = 0.78 + 0.22 * Math.sin(t * 8.5 + px * 0.6);
  const plume = (len: number, halfW: number, alpha: number) => {
    g.fillStyle = rgba(TEAL, alpha);
    g.beginPath();
    g.moveTo(-halfW, R * 1.66);
    // 모서리 없는 물방울 — 624 가 뺀 "각진 불꽃" 과 갈라지는 지점이다
    g.bezierCurveTo(-halfW, R * 1.66 + len * 0.55, -halfW * 0.5, R * 1.66 + len, 0, R * 1.66 + len);
    g.bezierCurveTo(halfW * 0.5, R * 1.66 + len, halfW, R * 1.66 + len * 0.55, halfW, R * 1.66);
    g.closePath();
    g.fill();
  };
  plume(R * 1.25 * flicker, R * 0.42, 0.38);
  plume(R * 0.72 * flicker, R * 0.22, 0.85);

  // 지느러미 — 뒤로 뻗은 둥근 날. 몸통 뒤에 깔린다
  g.fillStyle = rgba(TEAL, 1);
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * R * 0.75, R * 0.55);
    g.bezierCurveTo(sx * R * 1.25, R * 0.85, sx * R * 1.45, R * 1.25, sx * R * 1.4, R * 1.55);
    g.bezierCurveTo(sx * R * 1.25, R * 1.6, sx * R * 0.9, R * 1.5, sx * R * 0.65, R * 1.4);
    g.closePath();
    g.fill();
  }

  // 몸통 — 둥근 코, 꼬리로 갈수록 좁아지는 물방울
  const body = () => {
    g.beginPath();
    g.moveTo(0, -R * 1.25);
    g.bezierCurveTo(R * 0.65, -R * 1.25, R * 1.05, -R * 0.5, R * 1.05, R * 0.15);
    g.bezierCurveTo(R * 1.05, R * 0.8, R * 0.75, R * 1.35, R * 0.45, R * 1.5);
    g.lineTo(-R * 0.45, R * 1.5);
    g.bezierCurveTo(-R * 0.75, R * 1.35, -R * 1.05, R * 0.8, -R * 1.05, R * 0.15);
    g.bezierCurveTo(-R * 1.05, -R * 0.5, -R * 0.65, -R * 1.25, 0, -R * 1.25);
    g.closePath();
  };
  body();
  g.fillStyle = "#e9f1ff";
  g.fill();
  // 오른쪽 절반 음영 — 평면 아이콘의 두 톤
  g.save();
  body();
  g.clip();
  g.fillStyle = "#cfd9f7";
  g.fillRect(0, -R * 1.3, R * 1.2, R * 3);
  g.restore();

  // 꼬리 밴드(분사구). 창 테와 같은 ink4 였는데 몸통 밑에서 어둠에 묻혔다 — violet 으로 띄운다 (S15P21A405-641)
  g.fillStyle = "#a67cff";
  g.beginPath();
  g.moveTo(-R * 0.45, R * 1.5);
  g.lineTo(R * 0.45, R * 1.5);
  g.bezierCurveTo(R * 0.45, R * 1.65, R * 0.25, R * 1.75, 0, R * 1.75);
  g.bezierCurveTo(-R * 0.25, R * 1.75, -R * 0.45, R * 1.65, -R * 0.45, R * 1.5);
  g.closePath();
  g.fill();

  // 창 — 얇은 어두운 테와 보라 유리. 사진이 있으면 부르는 쪽이 유리 위에 덮는다 (R * 0.72)
  g.fillStyle = "#3a4761";
  g.beginPath();
  g.arc(0, 0, R * 0.84, 0, 6.284);
  g.fill();
  g.fillStyle = "#a67cff";
  g.beginPath();
  g.arc(0, 0, R * 0.72, 0, 6.284);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.35)";
  g.beginPath();
  g.arc(-R * 0.22, -R * 0.22, R * 0.16, 0, 6.284);
  g.fill();
  g.restore();
}

/** 탑승 후 선미 뒤로 줄줄이 달리는 동승자 (나 + 다른 사람들) */
export function drawQueue(g: CanvasRenderingContext2D, px: number, py: number, R: number, ang: number, t: number, riders: number) {
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  /**
   * 동승자 프로필 크기·간격 (S15P21A405-642). 0.5·1.62 였다 — 내 우주선(R=13) 기준 반지름이
   * 6.5px 라, 누가 몇 명 달렸는지는 보여도 **누구인지**는 안 보였다. 얼굴이 읽히는 크기로 올린다.
   * 간격도 같이 벌린다 — 반지름만 키우면 지름이 간격을 채워 붙어 보인다.
   * 0.58·1.78 → 0.68·1.92 (요청, 2026-09-25). 얼굴이 더 읽히게 한 번 더 올렸다.
   */
  const rr = R * 0.68;
  const step = R * 1.92;
  const shown = Math.min(5, riders + 1);
  const extra = riders + 1 - shown;
  const at = (i: number): [number, number] => {
    const wob = Math.sin(t * 2.2 - i * 0.9) * R * 0.17;
    const d = step * (i + 2.7);
    return [px + nx * d - ny * wob, py + ny * d + nx * wob];
  };
  g.save();
  g.strokeStyle = "rgba(180,205,245,.28)";
  g.lineWidth = 1.1;
  g.setLineDash([3, 4]);
  g.beginPath();
  g.moveTo(px + nx * R * 1.2, py + ny * R * 1.2);
  for (let i = 0; i < shown + (extra > 0 ? 1 : 0); i++) {
    const [qx, qy] = at(i);
    g.lineTo(qx, qy);
  }
  g.stroke();
  g.restore();
  for (let i = 0; i < shown; i++) {
    const [qx, qy] = at(i);
    const mine = i === 0;
    const rgb: readonly [number, number, number] = mine ? TEAL : genreRgb(i * 3);
    drawHelmet(g, qx, qy, rr, rgb, mine);
    drawVisor(g, qx, qy, rr, mine ? ME_AVATAR : { ...ME_AVATAR, email: `rider-${i}`, genreId: i * 3, avatarSeed: [0.1 * i, 0.4, 0.6, 0.3, 0.7, 0.2] });
    if (mine) {
      g.beginPath();
      g.arc(qx, qy, rr * 1.75, 0, 6.284);
      g.strokeStyle = "rgba(79,227,206,.9)";
      g.lineWidth = 1.6;
      g.stroke();
      g.fillStyle = "rgba(79,227,206,.95)";
      g.font = `600 10px ${FONTS.mono}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("나", qx, qy + rr * 2.6);
    }
  }
  if (extra > 0) {
    const [qx, qy] = at(shown);
    g.beginPath();
    g.arc(qx, qy, rr * 1.28, 0, 6.284);
    g.fillStyle = "rgba(14,21,38,.9)";
    g.fill();
    g.strokeStyle = "rgba(212,229,255,.6)";
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = "rgba(233,241,255,.9)";
    g.font = `600 ${(rr * 1.1).toFixed(1)}px ${FONTS.mono}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(`+${extra}`, qx, qy);
  }
}

/** 주변 친구 전체 — 동선 잔상 → 헬멧/우주선 → 접속 점 → 이름 */
/**
 * "N명" 뭉치 (S15P21A405-482, 실시간 작업명세 §5.2 B).
 *
 * 화면이 넓거나 사람이 많으면 서버가 개별 사람 대신 이걸 준다. 개별 표식과 **같이 뜨지 않는다** —
 * 서버가 둘 중 한 모드로만 답하므로 한쪽은 늘 비어 있다.
 *
 * 우주인처럼 그리지 않는다. 숫자가 요점이라 원 하나에 인원수만 적는다 — 사람 모양으로 그리면
 * "저기 한 명 있다" 로 읽혀서 14명이 한 명으로 보인다.
 */
function drawCrowd(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.crowdLayer !== e.layer || !e.crowd.length) return;
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const c of e.crowd) {
    const { px, py } = e.worldToScreen(c.x, c.y);
    // 인원이 많을수록 조금 커지되 로그로 눌러 둔다 — 100명이 10명의 열 배가 되면 화면을 덮는다
    const r = 11 + Math.min(13, Math.log2(Math.max(1, c.count)) * 3.2);
    g.globalAlpha = 0.16;
    g.fillStyle = "#5c9dff";
    g.beginPath();
    g.arc(px, py, r, 0, 6.3);
    g.fill();
    g.globalAlpha = 0.85;
    g.strokeStyle = "#9fe1cb";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(px, py, r, 0, 6.3);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = "#e9f1ff";
    g.font = `600 ${Math.round(r * 0.78)}px ${FONTS.body}`;
    g.fillText(String(c.count), px, py + 0.5);
  }
  g.restore();
}

export function drawFriends(g: CanvasRenderingContext2D, e: MapEngine) {
  drawCrowd(g, e);
  if (e.friendAlpha < 0.01) return;
  const t = e.time;
  const fade = e.friendAlpha;
  g.globalCompositeOperation = "source-over";
  // 동선 잔상
  g.lineCap = "round";
  g.lineWidth = 1.3;
  for (const fr of e.visFriends) {
    const tr = trailOf(fr.user.email);
    const rgb = genreRgb(fr.user.genreId);
    const sc = 24 * fr.scale;
    for (let k = 0; k < tr.length - 1; k++) {
      const a0 = 1 - k / (tr.length - 1);
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.8 - k * 0.55 + fr.px * 0.01);
      g.globalAlpha = 0.085 * a0 * pulse * fade;
      g.strokeStyle = rgba(rgb, 1);
      g.beginPath();
      g.moveTo(fr.px + tr[k][0] * sc, fr.py + tr[k][1] * sc);
      g.lineTo(fr.px + tr[k + 1][0] * sc, fr.py + tr[k + 1][1] * sc);
      g.stroke();
    }
  }
  g.globalAlpha = fade;

  g.textAlign = "center";
  g.textBaseline = "middle";
  /**
   * 그리는 순서 = 깊이 순서. **먼(작은) 표식부터, 가까운(큰) 표식이 위에** (S15P21A405-632) —
   * 크기는 서 있는 별의 깊이를 따르는데(614) 순서가 이를 모르면 뒤쪽 작은 헬멧이 앞쪽 큰 헬멧을
   * 덮어 원근이 뒤집힌다. 인솔자는 그 위 맨 마지막에 — 겹치는 표식 위에 올라와야 따라가는
   * 우주선이 가려지지 않는다 (S15P21A405-625).
   */
  const order = [...e.visFriends].sort((a, b) => Number(a.isLeader) - Number(b.isLeader) || a.scale - b.scale);
  for (const fr of order) {
    const { px, py, user: u, isLeader } = fr;
    const riders = u.riderCount + (isLeader ? 1 : 0);
    const ship = riders > 0;
    // 서 있는 별의 깊이만큼 키운다 — 위치는 이미 그 별의 시차를 따르니 크기도 따라야 원근이 된다 (S15P21A405-614)
    const R = (isLeader ? FRIEND_MARKER.leaderRadiusPx : FRIEND_MARKER.radiusPx) * fr.scale;
    const rgb = genreRgb(u.genreId);
    if (isLeader) {
      const rr = R * 1.9 + Math.sin(t * 2.4) * 3.5;
      g.beginPath();
      g.arc(px, py, rr, 0, 6.284);
      g.strokeStyle = "rgba(166,124,255,.5)";
      g.lineWidth = 1.2;
      g.stroke();
    }
    if (ship) {
      const ang = fr.heading + Math.PI / 2;
      // 배는 헬멧보다 크다 (S15P21A405-642). 접속 점·닉네임 자리는 헬멧 기준 `R` 을 그대로 쓴다
      const SR = R * FRIEND_MARKER.shipScale;
      if (isLeader) drawQueue(g, px, py, SR, ang, t, u.riderCount);
      drawShip(g, px, py, SR, ang, t);
      // 창 크기는 drawShip 의 유리(R * 0.72)와 같아야 한다 — 다르면 보라 테가 비치거나 사진이 테를 덮는다
      drawVisor(g, px, py, SR * 0.72, u);
    } else {
      drawHelmet(g, px, py, R, rgb, isLeader);
      drawVisor(g, px, py, R, u);
    }
    // 접속 점
    g.beginPath();
    g.arc(px + R * (ship ? 0.95 : 0.82), py + R * (ship ? 0.95 : 0.82), 2.9, 0, 6.284);
    g.fillStyle = "#4fe3ce";
    g.fill();
    g.strokeStyle = "#02040a";
    g.lineWidth = 1.3;
    g.stroke();
    /**
     * **겹쳐 선 사람 수** (S15P21A405-550). 이 표식 뒤에 몇 명이 더 있는지 적는다.
     *
     * 예전에는 겹친 사람을 아예 안 그렸다 — 같은 곡을 들으면 좌표가 같아서 한 명만 남았고,
     * 나머지는 접속해 있는데도 화면에서 사라졌다. 이제 묶어서 수로 보여 준다.
     *
     * 표식 **왼쪽 위**에 붙인다. 오른쪽 아래는 접속 점이, 아래는 닉네임이 이미 쓰고 있다.
     * 혼자면 그리지 않는다 — 모든 표식에 `1` 이 붙으면 숫자가 뜻을 잃는다.
     */
    const more = fr.stacked.length;
    if (more > 0) {
      const bx = px - R * (ship ? 0.95 : 0.82);
      const by = py - R * (ship ? 0.95 : 0.82);
      const label = `+${more}`;
      g.font = `600 11px ${FONTS.body}`;
      // 자릿수가 늘면 알약이 옆으로 늘어난다. 동그라미로 두면 세 자리에서 글자가 삐져나온다
      const w = Math.max(15, g.measureText(label).width + 9);
      const h = 13;
      g.beginPath();
      g.roundRect(bx - w / 2, by - h / 2, w, h, h / 2);
      g.fillStyle = "rgba(2,4,10,.82)";
      g.fill();
      g.strokeStyle = rgba(rgb, 0.75);
      g.lineWidth = 1.1;
      g.stroke();
      g.fillStyle = "#e9f1ff";
      g.fillText(label, bx, by + 0.5);
    }

    /**
     * 닉네임은 **별 제목 줄보다 아래**에 둔다 (S15P21A405-618). 사람이 선 별에는 커버 제목
     * (`py + 14~23 + 9`)이나 선택 링 제목(`py + rr + 15.5`)이 같은 자리에 오는데, 예전 `+9` 는
     * 그 줄과 겹쳐 둘 다 읽히지 않았다. 헬멧 지름 하나만큼 더 내려 제목 줄 밑으로 보낸다.
     */
    g.fillStyle = "rgba(233,241,255,.62)";
    g.font = `500 ${FRIEND_MARKER.namePx}px ${FONTS.body}`;
    g.fillText(u.nickname ?? "", px, py + R * (ship ? 2.2 : 1.75) + 22);
  }
  g.globalAlpha = 1;
}
