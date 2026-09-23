"use client";

import { useGenerateContestTemplateMutation } from "@/hooks/mutations/use-generate-contest-template-mutation";
import { useContestTemplatesQuery } from "@/hooks/queries/use-contest-templates-query";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { ContestTemplate } from "@/types";

interface TemplatePickerProps {
  loggedIn: boolean;
  /** 이번 회차 테마 — 목록 첫 줄에 적는다 */
  theme: string;
}

/**
 * AI 추천 모양 (S15P21A405-595 · 640). 그리기 도구 줄에 서는 셀렉트 — 고르면 서버가 그 모양대로 곡을 골라 **플레이리스트를
 * 만들고**, 결과가 매칭 결과 자리에 들어온다. 그 뒤는 그려서 찾은 것과 같다: 이름 짓고 출품.
 *
 * 버튼이 아니라 셀렉트인 이유: 모양이 셋(앉은·스케치·엎드린)이고 이름을 보고 골라야 한다. 매번 고르는 것이라 값은 비워 둔다.
 * 템플릿 API 가 로그인 필수라 로그인 전에는 잠근다.
 */
export default function TemplatePicker({ loggedIn, theme }: TemplatePickerProps) {
  const { data: templates } = useContestTemplatesQuery(loggedIn);
  const setMatch = useContestStore((s) => s.setMatch);
  const clear = useContestStore((s) => s.clear);
  const toast = useToastStore((s) => s.show);
  const generate = useGenerateContestTemplateMutation();

  const pick = (t: ContestTemplate) => {
    generate.mutate(t, {
      onSuccess: (m) => {
        // 그리던 점은 치운다 — 추천 결과는 그 점의 답이 아니다. `clear` 가 match 도 비우니 그 뒤에 넣는다
        clear();
        setMatch(m);
        toast(`AI 가 ${t.label} 모양으로 ${m.tracks.length}곡을 골랐어요 · 플레이리스트 「${m.template?.playlistName ?? t.label}」`);
      },
      onError: (e) => toast(e.message),
    });
  };

  const disabled = !loggedIn || generate.isPending || !templates?.length;
  return (
    <select
      aria-label="AI 추천 모양"
      title={!loggedIn ? "로그인하면 AI 추천 모양을 쓸 수 있어요" : `AI 가 ${theme} 모양대로 곡을 골라 별자리를 만들어요 · 플레이리스트가 함께 생겨요`}
      value=""
      disabled={disabled}
      onChange={(e) => {
        const t = templates?.find((x) => x.name === e.target.value);
        if (t) pick(t);
      }}
      className="h-[30px] rounded-box-xs border border-violet/35 bg-violet/[.14] px-2 text-xs text-ink-2 transition-colors hover:bg-violet/25 focus:outline-none disabled:opacity-45"
    >
      <option value="" disabled>
        {generate.isPending ? "AI 가 고르는 중..." : "✨ AI 추천 모양"}
      </option>
      {templates?.map((t) => (
        <option key={t.name} value={t.name}>
          {t.label} · {t.pointCount}곡
        </option>
      ))}
    </select>
  );
}
