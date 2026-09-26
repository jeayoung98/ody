"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Divider from "@/components/common/divider";
import Note from "@/components/common/note";
import { SKETCH_RULES } from "@/constants";
import { useContestMatchMutation } from "@/hooks/mutations/use-contest-match-mutation";
import { useContestMineQuery } from "@/hooks/queries/use-contest-mine-query";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { myEntry, roundPhase, sketchStep } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest } from "@/types";
import MatchResult from "./match-result";
import MyWorkView from "./my-work-view";
import SketchCanvas from "./sketch-canvas";
import SketchSteps from "./sketch-steps";
import SubmitForm from "./submit-form";
import TemplatePicker from "./template-picker";

/**
 * 별자리 그리기 (S15P21A405-602 · 598 · 640).
 *
 * 흐름: 점 찍기 → **별 찾기**(`/api/artwork/draw`) → 이름 짓고 출품 → **AI 채점은 출품 뒤** 서버가 하고 내 작품 카드가
 * 결과를 받아 보인다. 그리기 대신 **AI 추천 모양**(`/api/artwork/generate`, `TemplatePicker`)으로 시작할 수도 있다 —
 * 그 결과도 같은 `match` 자리에 들어와 뒤는 같다. 602 목의 "결과가 오면 바로 심사" 는 기획에서 빠졌다 (호출당 비용, 출품당 1회).
 * 점을 건드리면 매칭 결과가 사라진다 — 다른 모양에 붙은 결과가 남아 있으면 안 된다.
 *
 * **내 작품과 새 그림을 나눈다** (S15P21A405-693). 예전에는 이미 낸 작품 카드(점수 포함)가 새로 그리는 동안에도
 * 오른쪽에 붙어 있어 "지금 그림의 점수" 로 읽혔다. 이제 낸 작품이 있으면 **내 작품 화면**으로 열고, 새로 그리기를
 * 누를 때 교체된다고 먼저 말한다. 그리는 동안에는 이전 작품을 한 줄로만 적는다. 위에는 단계 표시가 늘 선다.
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
  const title = useContestStore((s) => s.title);
  const toast = useToastStore((s) => s.show);
  const matchMut = useContestMatchMutation();
  const { data: me } = useMeQuery();
  const { data: mine } = useContestMineQuery(!!me);
  const my = myEntry(mine);
  /** 새로 그리는 중인가. 그리다 만 점·결과가 남아 있으면 그 화면으로 연다 — 창을 닫았다 열어도 그림을 잃지 않게 */
  const [drawingNew, setDrawingNew] = useState(() => points.length > 0 || match != null);
  const viewingMine = my != null && !drawingNew;
  /** 곡 목록에서 가리키는 순번 — 캔버스가 그 별에 고리를 두른다 */
  const [hovered, setHovered] = useState<number | null>(null);

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

  if (viewingMine) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <SketchSteps current={sketchStep({ viewingMine, mine: my, match, title })} />
        <MyWorkView entry={my} contest={contest} onDrawNew={() => setDrawingNew(true)} />
      </div>
    );
  }

  /*
   * 모달이라 넉넉하다 — 왼쪽은 캔버스(그리는 곳), 오른쪽은 결과·출품·내 작품(읽는 곳). 폰에서는 세로로 쌓인다.
   *
   * **스크롤 없이 들어간다** (S15P21A405-665). 도구 버튼을 캔버스 **안** 상단에 얹어 한 줄을 아꼈고, 캔버스는 화면
   * 높이(`52vh`)에도 매여 모달 높이(820)에서 아래 안내·별 찾기까지 보인다. 오른쪽은 결과가 오면 **곡 목록만 스크롤**하고
   * 출품 폼은 그 아래에 고정이다 — 뿌리가 `min-h-0 flex-1` 로 남은 높이를 받고, 목록이 그 안에서만 넘친다.
   */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SketchSteps current={sketchStep({ viewingMine, mine: my, match, title })} />
        {/* 이전 작품은 한 줄로만 — 카드로 두면 지금 그림의 점수처럼 읽힌다 */}
        {my && (
          <button type="button" onClick={() => setDrawingNew(false)} className="text-xs text-ink-3 hover:text-ink-2">
            현재 출품작 「{my.title}」{my.status === "SCORED" && my.score != null ? ` · AI ${my.score}점` : my.status === "PENDING" ? " · 채점 중" : ""} — 새로 내면 교체돼요 · <span className="underline">내 작품 보기</span>
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] items-stretch gap-6 max-tablet:grid-cols-1 max-tablet:items-start">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="relative mx-auto w-full max-w-[min(520px,52vh)] max-tablet:max-w-none">
            <SketchCanvas points={points} closed={closed} result={match?.tracks ?? null} onAdd={handleAdd} onRemove={removePoint} highlight={hovered} />
            {/* 도구는 캔버스 위 상단에 — 캔버스 클릭과 겹치지 않게 점은 그 아래에 찍힌다. 살짝 어두운 판 위에 얹어 별밭과 갈린다 */}
            <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 rounded-t-box-sm bg-void/55 px-2 py-1.5 backdrop-blur-[3px]">
              <Button size="sm" onClick={undo} disabled={!count}>
                한 점 되돌리기
              </Button>
              <Button size="sm" active={closed} onClick={toggleClosed} disabled={count < 3 && !match} title="마지막 점과 첫 점을 이어 닫힌 모양으로">
                마지막 → 첫 점 잇기
              </Button>
              <TemplatePicker loggedIn={!!me} theme={contest.theme} />
              <Button size="sm" variant="ghost" onClick={clear} disabled={!count && !match}>
                지우기
              </Button>
              <span className="num ml-auto text-xs text-ink-3">
                점 {count} / {maxPoints}
              </span>
            </div>
          </div>
          <Note>
            {match?.template
              ? `AI 가 ${match.template.label} 모양대로 고른 곡이에요. 이름을 지어 그대로 출품하거나, 점을 찍어 새로 그릴 수 있어요.`
              : match
                ? "점을 더 찍거나 빼면 결과가 지워지고 다시 찾아요."
                : `빈 곳을 누르면 점이 붙고, 찍힌 점을 다시 누르면 빠져요. 찍은 순서대로 이어져요. ${minPoints}개 이상이면 별을 찾을 수 있어요. 막막하면 ✨ AI 추천 모양으로 시작해 보세요.`}
          </Note>
          <Button variant="primary" className="w-full" disabled={!canMatch || matchMut.isPending} onClick={findStars}>
            {matchMut.isPending ? "별을 찾는 중..." : match ? "이 모양으로 다시 찾기" : "이 모양으로 별 찾기"}
          </Button>
        </div>

        <div className="flex min-h-0 flex-col gap-3.5">
          {match ? (
            <>
              <MatchResult match={match} className="min-h-0 flex-1" onHover={setHovered} />
              <Divider />
              <SubmitForm contest={contest} match={match} my={my} loggedIn={!!me} onSubmitted={() => setDrawingNew(false)} />
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
        </div>
      </div>
    </div>
  );
}
