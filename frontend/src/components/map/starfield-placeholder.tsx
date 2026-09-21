import { useMemo } from "react";
import { GENRE_COLORS } from "@/constants/design-tokens";
import { hash01 } from "./render/star-look";

/**
 * 별이 도착하기 전의 하늘 (S15P21A405-504, 밀도·실패 안내는 S15P21A405-505).
 *
 * 예전에는 빈 화면에 `loading stars` 한 줄이었다. 지도는 화면의 전부인데 그게 비어 있으면
 * 앱이 멈춘 것처럼 보인다 — 다른 패널이 스켈레톤으로 자리를 잡아 두는 것과 같은 일을 여기서 한다.
 *
 * **진짜 곡인 척하지 않는다.** 캔버스가 아니라 그 위의 장식 레이어라 엔진의 `songs` 에 섞이지
 * 않고, `pointer-events-none` 이라 클릭·호버도 받지 않는다. 실제 별이 도착하면 통째로 사라진다.
 * 자리도 개수도 실제 분포와 무관하다 — 여기서 할 일은 "여긴 별이 오는 곳이에요" 뿐이다.
 *
 * **개수는 화면 넓이에서 나온다** (S15P21A405-505). 44개 고정으로 뒀더니 큰 모니터에서는
 * 성기고 희미해서 빈 화면과 구별되지 않았다 — "별이 안 뜬다" 는 보고가 그거였다.
 */

/** 별 하나가 맡는 넓이(px²). 작을수록 촘촘하다 — 실제 지도보다는 한참 성기다 */
const AREA_PER_STAR = 12000;
const MIN_STARS = 60;
/** 이보다 많이 깔지 않는다. 잠깐 보고 사라질 화면에 DOM 을 수백 개 만들 이유가 없다 */
const MAX_STARS = 200;

function makeStars(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const rgb = GENRE_COLORS[Math.floor(hash01(i * 31 + 7) * GENRE_COLORS.length)];
    const mag = hash01(i * 17 + 3);
    const size = 2 + mag * 4;
    return {
      // 가장자리 4% 는 비운다 — 화면 끝에 반쯤 잘린 별이 붙으면 UI 얼룩처럼 보인다
      left: 4 + hash01(i * 7 + 1) * 92,
      top: 4 + hash01(i * 13 + 5) * 92,
      size,
      opacity: 0.35 + mag * 0.55,
      delay: hash01(i * 23 + 11) * 2.4,
      color: `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`,
      glow: size * 3.5,
    };
  });
}

interface StarfieldPlaceholderProps {
  width: number;
  height: number;
  /**
   * 상주 집합 요청이 끝내 실패했다. 실패하면 **글자를 하나도 띄우지 않고 별만 남긴다**
   * (S15P21A405-508). 안내 문구도 다시 시도 버튼도 없다 — 판단은 사용자 요청이다.
   *
   * 그래도 이 값을 받는 이유는 **불러오는 중 문구를 거두기 위해서**다. 없으면 요청이
   * 죽은 뒤에도 "별을 불러오는 중" 이 영원히 남아 거짓말이 된다.
   */
  failed?: boolean;
}

export default function StarfieldPlaceholder({ width, height, failed = false }: StarfieldPlaceholderProps) {
  // 자리는 인덱스에서 나오므로 화면이 커지면 앞의 별은 그대로 두고 뒤에 더 붙는다
  const count = Math.min(MAX_STARS, Math.max(MIN_STARS, Math.round((width * height) / AREA_PER_STAR)));
  const stars = useMemo(() => makeStars(count), [count]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="animate-pulse-dot absolute rounded-pill"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            background: s.color,
            boxShadow: `0 0 ${s.glow}px ${s.color}`,
            // 다 같이 깜빡이면 하늘이 아니라 신호등이 된다
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      {/* 실패하면 아무 말도 하지 않는다 — 빈 하늘보다는 별이 깔린 화면이 낫다는 판단이다 */}
      {!failed && <p className="lbl absolute inset-0 flex items-center justify-center">별을 불러오는 중</p>}
    </div>
  );
}
