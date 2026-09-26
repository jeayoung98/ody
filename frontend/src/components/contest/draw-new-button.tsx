"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import CenterDialog from "@/components/common/center-dialog";
import type { ContestEntry } from "@/types";

/**
 * 채점 단계 오른쪽 아래의 "새로 그리기" (S15P21A405-693 · 702). 다른 단계의 다음 버튼과 같은 자리·같은 크기다.
 *
 * 누르면 **교체된다는 것을 먼저 말하는 가운데 팝업**을 띄운다 — 점수·좋아요가 사라지는 일이라 모르고 넘어가면 안 된다.
 * 전역 확인 팝업(`useConfirmStore`)은 활동 전환 분석을 함께 남겨서 쓰지 않고 `CenterDialog` 를 쓴다.
 */
export default function DrawNewButton({ entry, onConfirm }: { entry: ContestEntry; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setAsking(true)}>
        새로 그리기
      </Button>
      {asking && (
        <CenterDialog title="새로 그릴까요" onClose={() => setAsking(false)}>
          <p className="text-sm leading-relaxed text-ink-2">
            회차당 작품은 1개예요. 새로 출품하면 「{entry.title}」은 지워지고 <b className="text-ink">AI 점수와 좋아요가 초기화</b>돼요. 새로 그리기만 해서는 아무것도 바뀌지 않아요.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setAsking(false)}>
              취소
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setAsking(false);
                onConfirm();
              }}
            >
              새로 그리기
            </Button>
          </div>
        </CenterDialog>
      )}
    </>
  );
}
