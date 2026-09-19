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
 * 패널·계기판을 접었다 펴는 손잡이 (S15P21A405-287 · 318 · 477).
 *
 * 좌하단 계기판과 우측 패널이 **같은 물건을 거울처럼 쓴다.** 예전에는 각자 자기 파일에서 같은
 * 클래스 줄을 따로 적어 두어 한쪽만 손보면 모양이 갈렸다 — 실제로 갈려 있었다.
 *
 * 모양은 **사다리꼴**이다. 몸통에 붙은 쪽이 제 높이고 바깥쪽이 살짝 낮아서, 몸통에서 자란
 * 혀처럼 보인다. 네모난 탭은 몸통과 따로 붙인 조각처럼 읽혔다. 자르는 일은 `clip-path` 가
 * 하는데, 그 탓에 **기울어진 위아래 변에는 테두리가 안 남는다** — 세로 두 변에만 남는다.
 * 유리의 두께는 그 세로 선과 블러가 맡는다.
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
      style={{
        // 바깥쪽 변만 위아래로 7%씩 깎아 사다리꼴을 만든다
        clipPath: outerRight ? "polygon(0 0, 100% 7%, 100% 93%, 0 100%)" : "polygon(100% 0, 0 7%, 0 93%, 100% 100%)",
      }}
      className={`glass-liquid absolute top-1/2 z-10 grid h-[62px] w-[17px] -translate-y-1/2 place-items-center rounded-none! text-ink-3 transition-colors hover:text-ink ${
        outerRight ? "-right-[17px] border-l-0!" : "-left-[17px] border-r-0!"
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={pointing === "left" ? "M6.5 1.5 3 5l3.5 3.5" : "M3.5 1.5 7 5 3.5 8.5"} />
      </svg>
    </button>
  );
}
