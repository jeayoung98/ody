"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Note from "@/components/common/note";
import { roundPhase } from "@/lib/contest-view";
import type { Contest, ContestEntry } from "@/types";
import MyArtworkCard from "./my-artwork-card";

interface MyWorkViewProps {
  entry: ContestEntry;
  contest: Contest;
  onDrawNew: () => void;
}

/**
 * 이미 낸 작품이 있을 때 그리기 탭의 첫 화면 (S15P21A405-693).
 *
 * 예전에는 이 카드가 새 그림 옆에 늘 붙어 있어 "지금 그림의 점수" 로 읽혔다. 이제 따로 보여 주고, 새로 그리려면
 * **교체된다는 것을 먼저 말하고** 한 번 더 누르게 한다 — 점수·좋아요가 사라지는 일이라 모르고 넘어가면 안 된다.
 * 확인은 이 자리에서 한다. 전역 확인 팝업(`useConfirmStore`)은 활동 전환 분석을 함께 남겨서 여기 쓰지 않는다.
 */
export default function MyWorkView({ entry, contest, onDrawNew }: MyWorkViewProps) {
  const [asking, setAsking] = useState(false);
  const open = roundPhase(contest) === "OPEN";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
      <MyArtworkCard entry={entry} theme={contest.theme} />
      {!open ? (
        <Note>지금은 접수 기간이 아니라 새로 낼 수 없어요.</Note>
      ) : asking ? (
        <div className="flex flex-col gap-2 rounded-box-sm border border-warn/30 bg-warn/[.06] px-3 py-2.5">
          <p className="text-sm leading-relaxed">
            회차당 작품은 1개예요. 새로 출품하면 「{entry.title}」은 지워지고 <b>AI 점수와 좋아요가 초기화</b>돼요. 새로 그리기만 해서는 아무것도 바뀌지 않아요.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setAsking(false)}>
              취소
            </Button>
            <Button size="sm" variant="primary" onClick={onDrawNew}>
              알겠어요, 새로 그릴게요
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setAsking(true)}>
          새로 그리기
        </Button>
      )}
    </div>
  );
}
