import type { ReactNode } from "react";

interface BoxProps {
  /** 헤더 제목. 없으면 헤더를 그리지 않는다 */
  title?: ReactNode;
  /** 제목 옆 소문자 모노 코드 (기능 ID 등) */
  code?: string;
  /** 헤더 우측 액션 영역 (닫기 버튼 등) */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 본문 패딩 제거 (리스트 등 꽉 채우는 콘텐츠용) */
  flush?: boolean;
}

/**
 * 기본 박스 = 글래스 패널. 패널/카드/모달 등 모든 "박스 형태" UI의 공통 틀.
 * 프로토타입 .glass + #pHead/#pBody 구조를 그대로 따른다.
 */
export default function Box({ title, code, actions, footer, children, className = "", flush = false }: BoxProps) {
  return (
    <section className={`glass flex min-h-0 flex-col overflow-hidden text-ink ${className}`}>
      {(title || actions) && (
        <header className="flex shrink-0 items-center gap-2.5 border-b border-line px-[15px] pt-3.5 pb-3">
          <h2 className="flex-1 truncate font-display text-lg font-semibold tracking-[0.01em]">{title}</h2>
          {code && <span className="lbl shrink-0">{code}</span>}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 overflow-y-auto ${flush ? "" : "flex flex-col gap-3.5 px-[15px] pt-3.5 pb-[18px]"}`}>{children}</div>
      {footer && <footer className="shrink-0 border-t border-line px-[15px] py-3">{footer}</footer>}
    </section>
  );
}
