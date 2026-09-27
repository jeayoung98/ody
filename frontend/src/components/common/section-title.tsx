import type { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  /** 우측 보조 텍스트/액션 */
  aside?: ReactNode;
  /**
   * 말투. 기본은 모노 대문자 라벨(`.lbl`, 11px)이고, `sentence` 는 사람 말로 쓴 제목이다
   * (S15P21A405-384). `이 곡과 가장 비슷해요!` 같은 문장을 11px 대문자 라벨로 적으면
   * 분류표처럼 읽힌다 — 말을 걸려면 크기가 있어야 한다.
   */
  tone?: "label" | "sentence";
}

/** .sectHead + .lbl — 패널 내부 소제목 */
export default function SectionTitle({ children, aside, tone = "label" }: SectionTitleProps) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <h3 className={tone === "sentence" ? "text-md font-medium text-ink-2" : "lbl"}>{children}</h3>
      {aside && <div className="text-xs text-ink-3">{aside}</div>}
    </div>
  );
}
