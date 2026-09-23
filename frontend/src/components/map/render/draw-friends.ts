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

/** 동승자가 있으면 헬멧이 우주선이 된다 (기수는 진행 방향) */
export function drawShip(g: CanvasRenderingContext2D, px: number, py: number, R: number, rgb: readonly [number, number, number], ang: number, t: number, riders: number, thrust: number) {
  g.save();
  g.translate(px, py);
  g.rotate(ang);
  const boost = (1 + Math.min(riders, 6) * 0.2) * (1 + thrust * 1.8);
  const fl = R * (1.5 + Math.sin(t * 9 + px) * 0.18) * boost;
  const gr = g.createLinearGradient(0, R * 1.15, 0, R * 1.15 + fl);
  gr.addColorStop(0, rgba(rgb, 0.95));
  gr.addColorStop(0.38, rgba(rgb, 0.36));
  gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-R * 0.5, R * 1.15);
  g.lineTo(R * 0.5, R * 1.15);
  g.lineTo(0, R * 1.15 + fl);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(16,24,44,.9)";
  g.strokeStyle = "rgba(216,233,255,.82)";
  g.lineWidth = 1.5;
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(0, -R * 1.6);
  g.lineTo(R * 0.62, -R * 0.2);
  g.lineTo(R * 1.5, R * 1.0);
  g.lineTo(R * 0.5, R * 0.85);
  g.lineTo(R * 0.5, R * 1.2);
  g.lineTo(-R * 0.5, R * 1.2);
  g.lineTo(-R * 0.5, R * 0.85);
  g.lineTo(-R * 1.5, R * 1.0);
  g.lineTo(-R * 0.62, -R * 0.2);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = rgba(rgb, 0.75);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-R * 0.2, -R * 0.95);
  g.lineTo(R * 0.2, -R * 0.95);
  g.stroke();
  g.fillStyle = rgba(rgb, 0.55);
  g.beginPath();
  g.roundRect(-R * 0.5, R * 0.98, R * 1.0, R * 0.24, R * 0.1);
  g.fill();
  g.restore();
}

/** 탑승 후 선미 뒤로 줄줄이 달리는 동승자 (나 + 다른 사람들) */
export function drawQueue(g: CanvasRenderingContext2D, px: number, py: number, R: number, ang: number, t: number, riders: number) {
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const rr = R * 0.5;
  const step = R * 1.62;
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
      g.font = `600 8.5px ${FONTS.mono}`;
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
  for (const fr of e.visFriends) {
    const { px, py, user: u, isLeader } = fr;
    const riders = u.riderCount + (isLeader ? 1 : 0);
    const ship = riders > 0;
    // 서 있는 별의 깊이만큼 키운다 — 위치는 이미 그 별의 시차를 따르니 크기도 따라야 원근이 된다 (S15P21A405-614)
    const R = (isLeader ? 15 : 12.5) * fr.scale;
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
      if (isLeader) drawQueue(g, px, py, R, ang, t, u.riderCount);
      drawShip(g, px, py, R, rgb, ang, t, riders, isLeader && e.follow?.mv ? 0.6 : 0);
      drawVisor(g, px, py, R * 0.66, u);
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
      g.font = `600 9px ${FONTS.body}`;
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

    g.fillStyle = "rgba(233,241,255,.62)";
    g.font = `500 9.5px ${FONTS.body}`;
    g.fillText(u.nickname ?? "", px, py + R * (ship ? 2.2 : 1.75) + 9);
  }
  g.globalAlpha = 1;
}
