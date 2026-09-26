"use client";

import { useState, type ReactNode } from "react";
import Button from "@/components/common/button";
import CenterDialog from "@/components/common/center-dialog";
import Note from "@/components/common/note";
import { roundPhase } from "@/lib/contest-view";
import type { Contest, ContestEntry } from "@/types";
import MyArtworkCard from "./my-artwork-card";

interface MyWorkViewProps {
  entry: ContestEntry;
  contest: Contest;
  onDrawNew: () => void;
  /** 카드 바로 밑에 카드 폭에 맞춰 붙는 안내 (채점 중·채점 끝) (S15P21A405-702) */
  note?: ReactNode;
}

/**
 * 이미 낸 작품이 있을 때 그리기 탭의 채점 단계 (S15P21A405-693 · 702).
 *
 * 새로 그리려면 **교체된다는 것을 먼저 말하고** 한 번 더 누르게 한다 — 점수·좋아요가 사라지는 일이라 모르고 넘어가면 안 된다.
 * 확인은 가운데 팝업이다(702). 카드 밑에 펼치면 화면이 밀리고 무엇을 묻는지 흐렸다. 전역 확인 팝업(`useConfirmStore`)은
 * 활동 전환 분석을 함께 남겨서 쓰지 않고 `CenterDialog` 를 쓴다.
 */
export default function MyWorkView({ entry, contest, onDrawNew, note }: MyWorkViewProps) {
  const [asking, setAsking] = useState(false);
  const open = roundPhase(contest) === "OPEN";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <MyArtworkCard entry={entry} theme={contest.theme} />
      {note && <p className="px-1 text-sm leading-relaxed text-ink-2">{note}</p>}
      {open ? (
        <Button className="w-full" onClick={() => setAsking(true)}>
          새로 그리기
        </Button>
      ) : (
        <Note>지금은 접수 기간이 아니라 새로 낼 수 없어요.</Note>
      )}
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
                onDrawNew();
              }}
            >
              새로 그리기
            </Button>
          </div>
        </CenterDialog>
      )}
    </div>
  );
}
