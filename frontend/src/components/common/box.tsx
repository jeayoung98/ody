import type { ReactNode, RefObject } from "react";

interface BoxProps {
  /** 헤더 제목. 없으면 헤더를 그리지 않는다 */
  title?: ReactNode;
  /** 헤더 좌측(제목 앞) 영역 (뒤로가기 버튼 등) */
  lead?: ReactNode;
  /** 헤더 우측 액션 영역 (닫기 버튼 등) */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 본문 패딩 제거 (리스트 등 꽉 채우는 콘텐츠용) */
  flush?: boolean;
  /**
   * 헤더·본문 **뒤에** 까는 배경 레이어 (곡 상세의 앨범 커버 등).
   * 절대배치 레이어를 넘긴다. 주면 헤더 밑줄을 지운다 — 배경 위를 가로지르는 선이 되기 때문.
   * 배경은 스크롤을 따라가지 않는다. 본문이 그 위를 덮으며 지나간다.
   */
  bg?: ReactNode;
  /** 본문(스크롤 상자) 참조 — 배경 레이어가 스크롤 위치를 읽어야 할 때 쓴다 */
  bodyRef?: RefObject<HTMLDivElement | null>;
}

/**
 * 기본 박스 = 글래스 패널.
 *
 * **기능 ID(`SONG-02` 등)를 머리에 달지 않는다** (S15P21A405-384). 개발자만 읽는 코드라
 * 사용자에게는 뜻 없는 글자다 — 실제로 화면에서 보고 "이게 뭐냐" 는 질문이 나왔다.
 * 어느 명세 항목인지는 각 컴포넌트 주석에 적어 둔다.
 * 패널/카드/모달 등 모든 "박스 형태" UI의 공통 틀.
 * 프로토타입 .glass + #pHead/#pBody 구조를 그대로 따른다.
 */
export default function Box({ title, lead, actions, footer, children, className = "", flush = false, bg, bodyRef }: BoxProps) {
  return (
    <section className={`glass-liquid relative flex min-h-0 flex-col overflow-hidden text-ink ${className}`}>
      {bg}
      {(title || lead || actions) && (
        <header
          /* 본문보다 위다 (z-20 > z-10). 헤더에서 내려오는 옵션 메뉴가 본문 뒤로 숨지 않아야
             한다 (S15P21A405-524) — 둘 다 z-10 이면 DOM 이 뒤인 본문이 위로 올라온다 */
          className={`relative z-20 flex shrink-0 items-center gap-2.5 px-[15px] pt-3.5 pb-3 max-tablet:px-gutter-sm ${bg ? "" : "border-b border-line"}`}
        >
          {/*
            폰에서는 아이콘의 **보이는 끝**을 좌우 여백선(20)에 맞춘다 (S15P21A405-703). 28px 버튼 안에 16px
            아이콘이 들고 그림도 칸 안쪽에 그려져서, 그대로 두면 ← 와 ✕ 가 본문 글줄보다 9~10px 안쪽에
            서 떠 보였다. 그 거리만큼 바깥으로 당긴다 (← 10.6px · ✕ 9.3px 계산값).
          */}
          {lead && <div className="-ml-1 flex shrink-0 items-center max-tablet:-ml-2.5">{lead}</div>}
          <h2 className="flex-1 truncate font-display text-lg font-semibold tracking-[0.01em]">{title}</h2>
          {actions && <div className="flex shrink-0 items-center gap-1 max-tablet:-mr-[9px]">{actions}</div>}
        </header>
      )}
      {/* `data-sheet-body` — 폰 시트 1 단 높이를 이 윗끝에서 잰다 (`use-sheet-peek`, S15P21A405-703) */}
      <div ref={bodyRef} data-sheet-body={flush ? undefined : ""} className={`scroll-quiet relative z-10 min-h-0 flex-1 overflow-y-auto ${flush ? "" : "flex flex-col gap-3.5 px-[15px] pt-3.5 pb-[18px] max-tablet:px-gutter-sm"}`}>{children}</div>
      {footer && <footer className="relative z-10 shrink-0 border-t border-line px-[15px] py-3 max-tablet:px-gutter-sm">{footer}</footer>}
    </section>
  );
}
