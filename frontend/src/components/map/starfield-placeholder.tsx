import { GENRE_COLORS } from "@/constants/design-tokens";
import { hash01 } from "./render/star-look";

/**
 * 별이 도착하기 전의 하늘 (S15P21A405-504).
 *
 * 예전에는 빈 화면에 `loading stars` 한 줄이었다. 지도는 화면의 전부인데 그게 비어 있으면
 * 앱이 멈춘 것처럼 보인다 — 다른 패널이 스켈레톤으로 자리를 잡아 두는 것과 같은 일을 여기서 한다.
 *
 * **진짜 곡인 척하지 않는다.** 캔버스가 아니라 그 위의 장식 레이어라 엔진의 `songs` 에 섞이지
 * 않고, `pointer-events-none` 이라 클릭·호버도 받지 않는다. 실제 별이 도착하면 통째로 사라진다.
 * 자리도 개수도 실제 분포와 무관하다 — 여기서 할 일은 "여긴 별이 오는 곳이에요" 뿐이다.
 */
const COUNT = 44;

/** 씨앗 하나로 자리·크기·색·깜빡임을 모두 뽑는다 — 새로고침해도 같은 하늘이다 */
const STARS = Array.from({ length: COUNT }, (_, i) => {
  const rgb = GENRE_COLORS[Math.floor(hash01(i * 31 + 7) * GENRE_COLORS.length)];
  const mag = hash01(i * 17 + 3);
  return {
    // 가장자리 6% 는 비운다 — 화면 끝에 반쯤 잘린 별이 붙으면 UI 얼룩처럼 보인다
    left: 6 + hash01(i * 7 + 1) * 88,
    top: 6 + hash01(i * 13 + 5) * 88,
    size: 1.5 + mag * 3,
    opacity: 0.2 + mag * 0.45,
    delay: hash01(i * 23 + 11) * 2.4,
    color: `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`,
  };
});

export default function StarfieldPlaceholder() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {STARS.map((s, i) => (
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
            boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
            // 다 같이 깜빡이면 하늘이 아니라 신호등이 된다
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <p className="lbl absolute inset-0 flex items-center justify-center">별을 불러오는 중</p>
    </div>
  );
}
