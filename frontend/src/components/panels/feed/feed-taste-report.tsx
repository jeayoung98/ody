"use client";

import Button from "@/components/common/button";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import Skeleton from "@/components/common/skeleton";
import Tag from "@/components/common/tag";
import { useGenerateTasteAnalysisMutation } from "@/hooks/mutations/use-generate-taste-analysis-mutation";
import { useTasteAnalysisQuery } from "@/hooks/queries/use-taste-analysis-query";
import { tasteView } from "@/lib/taste-view";

/**
 * 음악 취향 리포트 (S15P21A405-630). 좋아요한 곡의 16차원 좌표 분포를 백엔드가 읽어
 * 한 줄 요약과 근거 문장으로 돌려준다 (S15P21A405-512).
 *
 * **내 페이지에만 붙는다.** 백엔드가 토큰으로 사람을 정해서 남의 취향은 물어볼 수가 없다 —
 * 붙이고 싶어도 못 붙인다. 그래서 `feed-panel` 이 `isMe && me` 일 때만 이 컴포넌트를 세운다
 * (`me` 까지 보는 이유는 로그인 전에 401 이 확정된 요청을 보내지 않으려는 것이다).
 *
 * **기능 명세에 아직 없다.** FEATURES.md 의 마이페이지(USER-02) 대시보드 정의에 취향 리포트가
 * 없어서, 변경 제안(FEATURES.md 하단)으로만 올려 두었다. 확정 전까지는 이 자리가 임시다.
 *
 * 조회 실패는 **줄을 통째로 감춘다.** 마이페이지의 중심은 프로필과 플리 목록이고, 이건 곁들이는
 * 칸이다 — 여기서 빨간 오류 문구를 띄우면 프로필 전체가 고장 난 것처럼 읽힌다.
 */
export default function FeedTasteReport() {
  const { data, isPending, isError } = useTasteAnalysisQuery();
  const generate = useGenerateTasteAnalysisMutation();

  if (isError) return null;
  if (isPending) return <Skeleton h={44} rounded="box" />;
  if (!data) return null;

  const view = tasteView(data);
  const { report } = view;
  /** 버튼을 누른 직후부터 서버 응답까지 — 그 사이 또 누르면 429 가 난다 */
  const busy = generate.isPending || view.generating;

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle
        aside={
          report
            ? `좋아요 ${data.counts.valid.toLocaleString()}곡 기준`
            : data.counts.totalLiked > 0
              ? `좋아요 ${data.counts.totalLiked.toLocaleString()}곡`
              : undefined
        }
      >
        음악 취향
      </SectionTitle>

      {report ? (
        <>
          {/*
            요약은 이 칸에서 제일 큰 글자다 — 나머지는 그 한 줄을 뒷받침하는 근거다.
            표본이 적다는 말(잠정)은 문장이 아니라 **배지**다 (S15P21A405-639) — 문장 안에 박히면
            "나를 설명하는 한 문장" 이 아니라 면책 문구가 된다.
          */}
          <p className={`font-display text-[17px] leading-snug font-medium ${view.stale ? "text-ink-2" : "text-ink"}`}>
            {view.badge && (
              <span
                title={view.badge.title}
                className="mr-1.5 inline-block translate-y-[-2px] rounded-pill border border-warn/30 bg-warn/[.07] px-1.5 py-px align-middle text-2xs font-medium text-warn"
              >
                {view.badge.text}
              </span>
            )}
            {report.summary}
          </p>
          {/* 태그는 판정값(findings)으로 그린다 — 문장을 쪼개 짐작하지 않는다. 구 응답엔 없어 줄이 비면 안 그린다 */}
          {view.tags.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {view.tags.map((t) => (
                <li key={t.id}>
                  <Tag tone={t.strength === "strong" ? "teal" : "default"} title={t.title}>
                    {t.text}
                  </Tag>
                </li>
              ))}
            </ul>
          )}
          {report.narratives.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {report.narratives.map((n) => (
                <li key={n.findingId} className="text-xs leading-relaxed text-ink-3">
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        /* 아직 없을 때는 무엇이 생기는 칸인지부터 말해 준다 — 빈 제목만 두면 고장으로 읽힌다 */
        <Note>좋아요한 곡을 모아 <b>어떤 소리를 좋아하는지</b> 읽어 드려요.</Note>
      )}

      <div className="flex items-center justify-between gap-2">
        {view.notice ? <span className="min-w-0 flex-1 text-[13px] text-ink-4">{view.notice}</span> : <span className="flex-1" />}
        <Button
          size="sm"
          variant={report ? "secondary" : "primary"}
          disabled={!view.canGenerate || busy}
          onClick={() => generate.mutate()}
          className="shrink-0"
        >
          {busy ? "만드는 중" : view.buttonLabel}
        </Button>
      </div>
    </section>
  );
}
