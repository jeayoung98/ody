"use client";

import { useEffect, useRef, useState } from "react";
import { NO_GENRE_ID } from "@/constants";
import { genreRgb } from "@/constants/design-tokens";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { drawHelmet, drawVisor } from "@/components/map/render/draw-friends";
import { onPhotoLoaded } from "@/lib/avatar-photo";
import { seedOf } from "@/lib/avatar-seed";
import type { NearbyUser } from "@/types";

/**
 * 지도에 찍히는 그 우주복 헬멧 — **프로필 사진이 바이저 안에 들어간다** (S15P21A405-536).
 *
 * 그리는 함수(`drawHelmet`·`drawVisor`)를 지도 쪽에서 그대로 가져다 쓴다. 베껴 두면 한쪽만
 * 바뀐 채로 남고, 레이더와 지도가 다른 그림이면 레이더에서 본 사람을 지도에서 찾을 수 없다.
 *
 * `NearbyPerson` 에는 헬멧 색(`genreId`)도 얼굴 시드(`avatarSeed`)도 없다 — 이메일과 곡에서
 * 만든다. 뷰포트가 서버 응답을 `NearbyUser` 로 채울 때와 같은 방식이라 같은 얼굴이 나온다.
 */
interface HelmetAvatarProps {
  email: string;
  /** 바이저 안에 넣을 사진. 없으면 절차적 그림으로 떨어진다 */
  imageUrl?: string | null;
  /** 헬멧 색을 정하는 곡. 상주 집합에 없으면 무장르 색으로 떨어진다 */
  musicId?: number | null;
  size?: number;
  online?: boolean;
  /** 강조 테두리 (지도에서 인솔자에게 주는 것과 같다) */
  hot?: boolean;
}

export default function HelmetAvatar({ email, imageUrl, musicId, size = 40, online = false, hot = false }: HelmetAvatarProps) {
  /**
   * 사진은 나중에 도착한다. 지도는 계속 다시 그려서 저절로 반영되지만 여기는 한 번 그리고
   * 마는 자리라, 도착 신호를 받아 다시 그린다 — 없으면 절차적 그림인 채로 굳는다.
   */
  const [tick, setTick] = useState(0);
  useEffect(() => onPhotoLoaded(() => setTick((v) => v + 1)), []);

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
     * 좌우 통신 포드가 `R * 1.52` 까지 뻗는다(테두리 원은 `R * 1.3`). 제일 넓은 그 값으로
     * 반지름을 거꾸로 잡아야 양옆이 안 잘리고, 동시에 바이저가 필요 이상으로 작아지지 않는다 —
     * 지도에서는 잘릴 가장자리가 없어서 이 계산이 필요 없었다.
     */
    const R = size / 3.1;
    const c = size / 2;
    const user = {
      email,
      imageUrl: imageUrl ?? null,
      genreId: (musicId != null ? getMapEngine()?.genreOf(musicId) : null) ?? NO_GENRE_ID,
      avatarSeed: seedOf(email),
    } as NearbyUser;

    drawHelmet(g, c, c, R, genreRgb(user.genreId), hot);
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
    // tick 은 그리기에 안 쓰지만, 사진이 도착하면 다시 그리라는 신호라 의존성에 둔다
  }, [email, imageUrl, musicId, size, online, hot, tick]);

  return <canvas ref={ref} aria-hidden className="shrink-0" style={{ width: size, height: size }} />;
}
