import type { ReactNode, RefObject } from "react";

interface BoxProps {
  /** 헤더 제목. 없으면 헤더를 그리지 않는다 */
  title?: ReactNode;
  /** 제목 옆 소문자 모노 코드 (기능 ID 등) */
  code?: string;
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
 * 기본 박스 = 글래스 패널. 패널/카드/모달 등 모든 "박스 형태" UI의 공통 틀.
 * 프로토타입 .glass + #pHead/#pBody 구조를 그대로 따른다.
 */
export default function Box({ title, code, lead, actions, footer, children, className = "", flush = false, bg, bodyRef }: BoxProps) {
  return (
    <section className={`glass relative flex min-h-0 flex-col overflow-hidden text-ink ${className}`}>
      {bg}
      {(title || lead || actions) && (
        <header className={`relative z-10 flex shrink-0 items-center gap-2.5 px-[15px] pt-3.5 pb-3 ${bg ? "" : "border-b border-line"}`}>
          {lead && <div className="-ml-1 flex shrink-0 items-center">{lead}</div>}
          <h2 className="flex-1 truncate font-display text-lg font-semibold tracking-[0.01em]">{title}</h2>
          {code && <span className="lbl shrink-0">{code}</span>}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div ref={bodyRef} className={`relative z-10 min-h-0 flex-1 overflow-y-auto ${flush ? "" : "flex flex-col gap-3.5 px-[15px] pt-3.5 pb-[18px]"}`}>{children}</div>
      {footer && <footer className="relative z-10 shrink-0 border-t border-line px-[15px] py-3">{footer}</footer>}
    </section>
  );
}
