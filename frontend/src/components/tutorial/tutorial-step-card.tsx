import Button from "@/components/common/button";

interface TutorialStepCardProps {
  index: number;
  total: number;
  title: string;
  description: string;
  /** 누를 곳이 따로 없어 카드의 버튼으로 넘기는 단계만 전달 */
  onConfirm?: () => void;
  /** 그 버튼 글 */
  cta?: string;
  onSkip: () => void;
}

/** #tip — 스포트라이트 투어 카드. 점 진행 표시 + 모노 카운터 + 태스크 안내 */
export default function TutorialStepCard({ index, total, title, description, onConfirm, cta, onSkip }: TutorialStepCardProps) {
  return (
    <div className="glass animate-tin flex flex-col gap-[9px] rounded-[20px]! bg-toast! px-[17px] pt-4 pb-3.5">
      <div className="flex items-center gap-[9px]">
        <div className="flex flex-1 gap-[3px]">
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              className={`h-[5px] w-[5px] rounded-pill ${i === index ? "bg-teal shadow-[0_0_7px_#4fe3ce]" : i < index ? "bg-teal/45" : "bg-white/[.16]"}`}
            />
          ))}
        </div>
        <span className="lbl">
          {index + 1} / {total}
        </span>
      </div>
      <h3 className="m-0 font-display text-[16.5px] font-semibold text-balance">{title}</h3>
      <p className="m-0 text-[12.5px] leading-[1.62] text-ink-2">{description}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {/* 건너뛰기는 눈에 띄지 않게 */}
        <button type="button" onClick={onSkip} className="text-[11px] text-ink-4 opacity-60 hover:text-ink hover:opacity-100">
          건너뛰기
        </button>
        <span className="flex-1" />
        {onConfirm ? (
          <Button size="sm" variant="primary" onClick={onConfirm}>
            {cta}
          </Button>
        ) : (
          <span className="lbl text-teal">화면에서 직접 해보세요</span>
        )}
      </div>
    </div>
  );
}
