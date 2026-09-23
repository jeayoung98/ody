"use client";

import Button from "@/components/common/button";

/**
 * 튜토리얼 마무리 (S15P21A405-353). 마지막 단계가 끝나면 아무 말 없이 메인으로 튕겨 났다 —
 * 끝난 것인지 튕겨난 것인지 알 수 없고, 이제 무엇을 하면 되는지도 안 남았다.
 *
 * 화면을 블러로 덮어 **여기서 한 번 끊는다.** 버튼을 눌러야 탐험이 시작된다.
 */
export default function TutorialOutro({ onStart }: { onStart: () => void }) {
  return (
    <div className="animate-tfade pointer-events-auto fixed inset-0 z-[70] grid place-items-center bg-void/72 px-6 backdrop-blur-md">
      <div className="animate-tpop flex max-w-[380px] flex-col items-center gap-3.5 text-center">
        <span className="lbl text-teal">튜토리얼 끝</span>
        <h2 className="m-0 font-display text-[22px] leading-[1.3] font-bold text-balance">고생하셨어요. 이제 마음껏 돌아다녀보세요</h2>
        <p className="m-0 text-[14px] leading-[1.7] text-ink-2">
          확대해서 파고들고, 별을 눌러 들어보고, 주변 탐색과 여정으로 소리가 이어지는 길을 따라가보세요.
          <br />
          <b className="font-medium text-ink">설문이 뜨면 가장 먼저 답해주세요</b> — 이번 테스트에서 제일 중요한 부분입니다.
        </p>
        <Button variant="primary" className="mt-1.5 px-6! py-2.5!" onClick={onStart}>
          탐험 시작하기
        </Button>
      </div>
    </div>
  );
}
