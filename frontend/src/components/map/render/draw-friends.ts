import { FONTS, genreRgb, rgba } from "@/constants/design-tokens";
import type { NearbyUser } from "@/types";
import type { MapEngine } from "../engine/map-engine";
import { avatarFor, ME_AVATAR, trailOf } from "./sprites";

const TEAL: readonly [number, number, number] = [79, 227, 206];

/** 프로필을 바이저(유리창) 안에 넣은 우주 헬멧 */
function drawVisor(g: CanvasRenderingContext2D, px: number, py: number, R: number, u: NearbyUser) {
  const fade = g.globalAlpha;
  g.save();
  g.beginPath();
  g.arc(px, py, R, 0, 6.284);
  g.clip();
  g.drawImage(avatarFor(u), px - R, py - R, R * 2, R * 2);
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

function drawHelmet(g: CanvasRenderingContext2D, px: number, py: number, R: number, rgb: readonly [number, number, number], hot: boolean) {
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
function drawShip(g: CanvasRenderingContext2D, px: number, py: number, R: number, rgb: readonly [number, number, number], ang: number, t: number, riders: number, thrust: number) {
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
function drawQueue(g: CanvasRenderingContext2D, px: number, py: number, R: number, ang: number, t: number, riders: number) {
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
export function drawFriends(g: CanvasRenderingContext2D, e: MapEngine) {
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
    const sc = 24;
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
    const R = isLeader ? 15 : 12.5;
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
    g.strokeStyle = "#04060d";
    g.lineWidth = 1.3;
    g.stroke();
    g.fillStyle = "rgba(233,241,255,.62)";
    g.font = `500 9.5px ${FONTS.body}`;
    g.fillText(u.nickname ?? "", px, py + R * (ship ? 2.2 : 1.75) + 9);
  }
  g.globalAlpha = 1;
}
