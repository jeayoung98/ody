import Button from "@/components/common/button";
import { CloseIcon } from "@/components/common/icons";
import IconButton from "@/components/common/icon-button";

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
        {/*
          **나가는 길을 눈에 보이게 둔다** (S15P21A405-532). 여기서 나가는 길은 아래쪽 11px
          짜리 "건너뛰기" 글자 하나뿐이었는데, 그 크기는 **손가락으로 겨눌 수 있는 표적이
          아니다** (iOS HIG 44pt · Material 48dp). 폰에서 튜토리얼을 못 빠져나온다는 말이 나왔다.

          폰에서는 `::after` 로 **보이는 크기는 그대로 두고 누를 수 있는 넓이만** 44px 로
          넓힌다(28 + 8·2). 상자 안이 아니라 바깥으로 자라므로 줄 높이가 안 바뀐다 —
          `player/locate-button.tsx` 가 쓰는 것과 같은 방법이다.
        */}
        <IconButton
          label="튜토리얼 닫기"
          onClick={onSkip}
          className="relative -mr-1.5 text-ink-4 hover:text-ink max-tablet:after:absolute max-tablet:after:-inset-2 max-tablet:after:content-['']"
        >
          <CloseIcon />
        </IconButton>
      </div>
      <h3 className="m-0 font-display text-[17.5px] font-semibold text-balance">{title}</h3>
      <p className="m-0 text-[14.5px] leading-[1.62] text-ink-2">{description}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {/* 건너뛰기는 눈에 띄지 않게 */}
        <button type="button" onClick={onSkip} className="text-[13px] text-ink-4 opacity-60 hover:text-ink hover:opacity-100">
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
