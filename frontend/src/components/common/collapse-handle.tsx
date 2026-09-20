"use client";

interface CollapseHandleProps {
  /** 몸통의 **어느 쪽에 붙어 나오나**. `right` 면 몸통 오른쪽 바깥으로 튀어나온다 */
  side: "left" | "right";
  /** 화살표가 가리킬 쪽 — 누르면 몸통이 갈 방향이다 */
  pointing: "left" | "right";
  onClick: () => void;
  /** 펼쳐져 있나 (aria) */
  expanded: boolean;
  title: string;
}

/**
 * 손잡이 치수(px). `clip-path: path()` 가 절대좌표라 여기서 한 번에 정한다.
 *
 * 폭은 내보낸다 — 접힌 패널이 화면을 얼마나 가리는지 계산하는 쪽(`main-screen.tsx`)이 이 값을
 * 손으로 옮겨 적고 있다가 22→17 변경을 놓쳤다 (S15P21A405-479).
 */
export const HANDLE_W = 17;
const W = HANDLE_W;
const H = 62;
/**
 * 바깥쪽 변이 위아래로 깎이는 깊이 — 이만큼이 사다리꼴의 기울기다.
 * 4.5 는 너무 가팔라 혀가 아니라 화살표처럼 뾰족해 보였다. 긴 변 62 에 짧은 변 57 정도가
 * "살짝 좁아진다" 로 읽히는 선이다.
 */
const SLANT = 2.5;
/** 바깥쪽 두 모서리의 둥글기 */
const R = 7;

/**
 * 윤곽은 **하나뿐이다** — 바깥이 오른쪽인 모양 (S15P21A405-477).
 *
 * 예전에는 좌우 두 벌을 손으로 적어 뒀다. 좌표를 일일이 뒤집고 호(arc)의 sweep 플래그까지
 * 0/1 로 갈라 적어야 해서, 눈으로는 같은지 확인할 길이 없고 한쪽만 틀어져도 모른다.
 * 지금은 한 벌만 두고 왼쪽 것은 `scaleX(-1)` 로 뒤집는다 — **같을 수밖에 없다.**
 */
const CLIP = `path("M0 0 L${W - R} ${SLANT} A${R} ${R} 0 0 1 ${W} ${SLANT + R} L${W} ${H - SLANT - R} A${R} ${R} 0 0 1 ${W - R} ${H - SLANT} L0 ${H} Z")`;

/**
 * 패널·계기판을 접었다 펴는 손잡이 (S15P21A405-287 · 318 · 477).
 *
 * 좌하단 계기판과 우측 패널이 **같은 물건을 거울처럼 쓴다.** 예전에는 각자 자기 파일에서 같은
 * 클래스 줄을 따로 적어 두어 한쪽만 손보면 모양이 갈렸다 — 실제로 갈려 있었다.
 *
 * 모양은 **바깥 모서리가 둥근 사다리꼴**이다. 몸통에 붙은 쪽이 제 높이고 바깥쪽이 살짝 낮아서
 * 몸통에서 자란 혀처럼 보인다. 네모난 탭은 따로 붙인 조각처럼 읽혔다.
 *
 * 자르는 일은 `clip-path: path()` 가 한다 — `polygon()` 이 아닌 이유는 **둥근 모서리를 남기기
 * 위해서**다. polygon 의 꼭짓점은 늘 뾰족하고, `border-radius` 를 같이 걸어도 자르는 선이 그
 * 둥근 자리를 지나가 소용이 없다. 대신 `path()` 는 px 절대좌표라 **크기가 고정이어야 한다** —
 * 위 상수 넷이 그 크기다.
 *
 * **색판과 화살표를 나눠 둔다.** 뒤집기(`scaleX(-1)`)를 버튼째 걸면 화살표까지 뒤집힌다.
 * 그래서 자르고 칠하는 일은 안쪽 `<span>` 이 맡고, 화살표는 그 위에 따로 얹는다.
 *
 * 기울어진 위아래 변에는 테두리가 안 남는다(잘린 자리라서). 세로 변과 안쪽 하이라이트가 두께를 맡는다.
 *
 * **유리가 아니라 불투명한 남색 한 판이다** (`.glass-handle`, S15P21A405-477). 폭이 17px 뿐이라
 * 블러로는 뒤를 못 가렸고, 계기판 쪽은 부모가 유리라 블러가 먹지도 않아 좌우가 달라 보였다.
 * 색 하나로 칠해 어디에 붙어 있든 같게 만든다. 값은 `tokens.css` 의 `--glass-handle-bg`.
 */
export default function CollapseHandle({ side, pointing, onClick, expanded, title }: CollapseHandleProps) {
  const outerRight = side === "right";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      title={title}
      aria-label={title}
      style={{ width: W, height: H, [outerRight ? "right" : "left"]: -W }}
      className="glass-handle-host absolute top-1/2 z-10 grid -translate-y-1/2 place-items-center text-ink-3 transition-colors hover:text-ink"
    >
      {/* 색판. 왼쪽으로 나가는 손잡이는 같은 윤곽을 좌우로 뒤집어 쓴다 */}
      <span aria-hidden style={{ clipPath: CLIP, transform: outerRight ? undefined : "scaleX(-1)" }} className="glass-handle absolute inset-0" />
      <svg className="relative" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={pointing === "left" ? "M6.5 1.5 3 5l3.5 3.5" : "M3.5 1.5 7 5 3.5 8.5"} />
      </svg>
    </button>
  );
}
