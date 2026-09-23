"use client";

import Button from "@/components/common/button";
import Divider from "@/components/common/divider";
import Note from "@/components/common/note";
import { SKETCH_RULES } from "@/constants";
import { useContestMatchMutation } from "@/hooks/mutations/use-contest-match-mutation";
import { useContestMineQuery } from "@/hooks/queries/use-contest-mine-query";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { myEntry, roundPhase } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest } from "@/types";
import MatchResult from "./match-result";
import MyArtworkCard from "./my-artwork-card";
import SketchCanvas from "./sketch-canvas";
import SubmitForm from "./submit-form";

/**
 * 별자리 그리기 (S15P21A405-602 · 598 · 640).
 *
 * 흐름: 점 찍기 → **별 찾기**(`/api/artwork/draw`) → 이름 짓고 출품 → **AI 채점은 출품 뒤** 서버가 하고 내 작품 카드가
 * 결과를 받아 보인다. 602 목의 "결과가 오면 바로 심사" 는 기획에서 빠졌다 (호출당 비용, 출품당 1회).
 * 점을 건드리면 매칭 결과가 사라진다 — 다른 모양에 붙은 결과가 남아 있으면 안 된다.
 */
export default function SketchTab({ contest }: { contest: Contest }) {
  const points = useContestStore((s) => s.points);
  const closed = useContestStore((s) => s.closed);
  const match = useContestStore((s) => s.match);
  const addPoint = useContestStore((s) => s.addPoint);
  const removePoint = useContestStore((s) => s.removePoint);
  const undo = useContestStore((s) => s.undo);
  const clear = useContestStore((s) => s.clear);
  const toggleClosed = useContestStore((s) => s.toggleClosed);
  const setMatch = useContestStore((s) => s.setMatch);
  const toast = useToastStore((s) => s.show);
  const matchMut = useContestMatchMutation();
  const { data: me } = useMeQuery();
  const { data: mine } = useContestMineQuery(!!me);
  const my = myEntry(mine);

  const { minPoints, maxPoints } = SKETCH_RULES;
  const count = points.length;
  const canMatch = count >= minPoints && count <= maxPoints;
  const open = roundPhase(contest) === "OPEN";

  const findStars = () => {
    if (!canMatch) return;
    matchMut.mutate(points, { onSuccess: setMatch, onError: (e) => toast(e.message) });
  };

  const handleAdd = (p: Parameters<typeof addPoint>[0]) => {
    if (count >= maxPoints) {
      toast(`점은 ${maxPoints}개까지 찍을 수 있어요`);
      return;
    }
    addPoint(p);
  };

  // 모달이라 넉넉하다 — 왼쪽은 캔버스(그리는 곳), 오른쪽은 결과·출품·내 작품(읽는 곳). 폰에서는 세로로 쌓인다
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6 max-tablet:grid-cols-1">
      <div className="flex flex-col gap-3">
        <div className="mx-auto w-full max-w-[520px]">
          <SketchCanvas points={points} closed={closed} result={match?.tracks ?? null} onAdd={handleAdd} onRemove={removePoint} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={undo} disabled={!count}>
            한 점 되돌리기
          </Button>
          <Button size="sm" active={closed} onClick={toggleClosed} disabled={count < 3} title="마지막 점과 첫 점을 이어 닫힌 모양으로">
            마지막 → 첫 점 잇기
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={!count}>
            지우기
          </Button>
          <span className="num ml-auto text-xs text-ink-3">
            점 {count} / {maxPoints}
          </span>
        </div>
        <Note>
          {match
            ? "점을 더 찍거나 빼면 결과가 지워지고 다시 찾아요."
            : `빈 곳을 누르면 점이 붙고, 찍힌 점을 다시 누르면 빠져요. 찍은 순서대로 이어져요. ${minPoints}개 이상이면 별을 찾을 수 있어요.`}
        </Note>
        <Button variant="primary" className="w-full" disabled={!canMatch || matchMut.isPending} onClick={findStars}>
          {matchMut.isPending ? "별을 찾는 중..." : match ? "이 모양으로 다시 찾기" : "이 모양으로 별 찾기"}
        </Button>
      </div>

      <div className="flex flex-col gap-3.5">
        {match ? (
          <>
            <MatchResult match={match} />
            <Divider />
            <SubmitForm contest={contest} match={match} my={my} loggedIn={!!me} />
          </>
        ) : (
          !my && (
            <div className="flex flex-col gap-2 rounded-box-sm border border-dashed border-line px-4 py-5">
              <p className="text-sm font-medium">{contest.theme} 모양을 점으로 그려 보세요</p>
              <Note>
                그린 점과 닮은 배치의 곡을 별밭에서 찾아 별자리로 이어 줘요. 이름을 지어 출품하면 <b>AI 가 잠시 뒤 채점</b>하고, 좋아요와 함께 순위가 매겨져요.
                <br />
                회차당 작품 1개 · 좋아요 {contest.voteLimit}표{!open && " · 지금은 접수 기간이 아니에요"}
              </Note>
            </div>
          )
        )}
        {my && <MyArtworkCard entry={my} theme={contest.theme} />}
      </div>
    </div>
  );
}
