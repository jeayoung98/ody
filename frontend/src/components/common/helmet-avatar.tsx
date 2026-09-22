"use client";

import { useEffect, useRef } from "react";
import { NO_GENRE_ID } from "@/constants";
import { genreRgb } from "@/constants/design-tokens";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { drawHelmet, drawVisor } from "@/components/map/render/draw-friends";
import { seedOf } from "@/lib/avatar-seed";
import type { NearbyUser } from "@/types";

/**
 * 지도에 찍히는 그 우주 헬멧을 **패널 목록에도 그대로** 쓴다 (S15P21A405-536).
 *
 * 목록의 동그란 사진과 지도의 헬멧이 서로 다른 그림이면, 목록에서 본 사람을 지도에서 찾을 수가
 * 없다 — 같은 사람인지 알 길이 색밖에 없다. 그래서 그리는 함수(`drawHelmet`·`drawVisor`)를
 * 지도 쪽에서 그대로 가져다 쓴다. 베껴 두면 한쪽만 바뀐 채로 남는다.
 *
 * `NearbyPerson` 에는 헬멧 색(`genreId`)도 얼굴 시드(`avatarSeed`)도 없다 — 이메일과 곡에서
 * 만든다. 뷰포트가 서버 응답을 `NearbyUser` 로 채울 때와 같은 방식이라 같은 얼굴이 나온다.
 */
interface HelmetAvatarProps {
  email: string;
  /** 헬멧 색을 정하는 곡. 상주 집합에 없으면 무장르 색으로 떨어진다 */
  musicId?: number | null;
  size?: number;
  online?: boolean;
}

export default function HelmetAvatar({ email, musicId, size = 40, online = true }: HelmetAvatarProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    /**
     * 화면 배율만큼 크게 굽는다. 헬멧은 선이 1.2~2px 라 등배로 그리면 고해상도 화면에서
     * 뭉개진다 — 지도는 캔버스가 이미 배율을 먹고 있어 이 문제가 없다.
     */
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * dpr);
    const g = canvas.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);

    /**
     * 통신 포드가 `R * 1.88` 까지 뻗는다. 그걸로 반지름을 거꾸로 잡아야 양옆이 안 잘린다 —
     * 지도에서는 잘릴 가장자리가 없어서 이 계산이 필요 없었다.
     */
    const R = size / 3.8;
    const c = size / 2;
    const user = {
      email,
      genreId: (musicId != null ? getMapEngine()?.genreOf(musicId) : null) ?? NO_GENRE_ID,
      avatarSeed: seedOf(email),
    } as NearbyUser;

    drawHelmet(g, c, c, R, genreRgb(user.genreId), false);
    drawVisor(g, c, c, R, user);
    if (!online) return;
    // 접속 점. 지도와 같은 자리(R*0.82)·같은 색이다
    g.beginPath();
    g.arc(c + R * 0.82, c + R * 0.82, 2.9, 0, 6.284);
    g.fillStyle = "#4fe3ce";
    g.fill();
    g.strokeStyle = "#02040a";
    g.lineWidth = 1.3;
    g.stroke();
  }, [email, musicId, size, online]);

  return <canvas ref={ref} aria-hidden className="shrink-0" style={{ width: size, height: size }} />;
}
