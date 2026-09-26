"use client";

import Button from "@/components/common/button";
import SectionTitle from "@/components/common/section-title";
import Skeleton from "@/components/common/skeleton";
import Tag from "@/components/common/tag";
import { useRetryContestEntryMutation } from "@/hooks/mutations/use-retry-contest-entry-mutation";
import { useContestArtworkQuery } from "@/hooks/queries/use-contest-artwork-query";
import { useToastStore } from "@/stores/use-toast-store";
import { MY_ARTWORK_THUMB_PX } from "@/constants";
import type { ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";

const STATUS_LABEL = { PENDING: "채점 중", SCORED: "채점 완료", FAILED: "채점 실패" } as const;

/**
 * 내 작품의 AI 채점 (S15P21A405-640). **출품 뒤에 온다** — 즉시 심사(602 목)는 기획에서 빠졌고, 서버가 5초 주기로
 * 뒤에서 채점한다 (§6-2). `PENDING` 이면 `use-contest-mine-query` 가 폴링하고, 이 카드는 그 결과만 보여 준다.
 * `FAILED` 는 점수가 `null` 이다 — 0점으로 보이면 "못생겼다" 가 된다. 3회까지 다시 평가받을 수 있다.
 */
/** `showComment` 가 false 면 AI 한 줄 평을 카드에서 뺀다 — 그리기 탭은 그걸 아래 버튼 줄 왼쪽에 둔다 (S15P21A405-702) */
export default function MyArtworkCard({ entry, theme, showComment = true }: { entry: ContestEntry; theme: string; showComment?: boolean }) {
  const toast = useToastStore((s) => s.show);
  const retry = useRetryContestEntryMutation();
  const pending = entry.status === "PENDING";
  const failed = entry.status === "FAILED";
  /**
   * 채점이 끝나면 **그 별자리를 점수 위에 그린다** (S15P21A405-701). 내 작품 목록은 좌표를 안 줘서 상세를 따로 받는다.
   * 받는 동안·실패하면 그림 자리만 비고 점수·코멘트는 그대로다.
   */
  const { data: shape } = useContestArtworkQuery(entry.status === "SCORED" ? entry.artworkId : null);

  return (
    <div className="flex flex-col gap-2 rounded-box-sm border border-line bg-white/[.03] px-3 py-2.5">
      <SectionTitle aside={<Tag tone={pending ? "violet" : failed ? "warn" : "teal"}>{STATUS_LABEL[entry.status]}</Tag>}>
        내 작품 · {entry.title}
      </SectionTitle>
      {pending && (
        <div className="flex flex-col gap-2 py-1">
          <Skeleton w={72} h={30} rounded="box" />
          <Skeleton w="88%" h={11} />
          <p className="text-xs text-ink-3">AI 가 {theme} 모양을 살펴보는 중이에요. 끝나면 여기에 바로 떠요.</p>
        </div>
      )}
      {entry.status === "SCORED" && (
        <>
          {shape && shape.tracks.length > 1 && (
            <ConstellationThumb tracks={shape.tracks} closed={shape.closed} size={MY_ARTWORK_THUMB_PX} className="mx-auto my-1 border border-line" />
          )}
          {/* 화면에서 숫자 점수는 이것 하나다 — 출품 전 모양 일치도는 말로만 적는다 (S15P21A405-693) */}
          <span className="lbl">AI 심사 점수</span>
          <div className="flex items-baseline gap-1.5">
            <span className="num grad-text text-[38px] leading-none font-semibold">{entry.score}</span>
            <span className="lbl">/ 100</span>
            <span className="num ml-auto text-xs text-ink-3">♥ {entry.likeCnt}</span>
          </div>
          <span className="h-1 overflow-hidden rounded-pill bg-white/[.08]">
            <i className="grad-bg block h-full rounded-pill" style={{ width: `${Math.max(3, entry.score ?? 0)}%` }} />
          </span>
          {showComment && entry.aiComment && <p className="text-sm leading-relaxed">{entry.aiComment}</p>}
          <p className="text-xs text-ink-3">갤러리와 순위에 올라갔어요. 다시 출품하면 이 점수와 좋아요는 사라져요.</p>
        </>
      )}
      {failed && (
        <>
          <p className="text-sm leading-relaxed text-bad">채점에 실패했어요{entry.failReason ? ` — ${entry.failReason}` : ""}</p>
          <Button
            size="sm"
            variant="secondary"
            disabled={retry.isPending}
            onClick={() => retry.mutate(entry.artworkId, { onSuccess: () => toast("다시 채점을 요청했어요"), onError: (e) => toast(e.message) })}
          >
            {retry.isPending ? "요청 중..." : "다시 채점받기"}
          </Button>
        </>
      )}
    </div>
  );
}
