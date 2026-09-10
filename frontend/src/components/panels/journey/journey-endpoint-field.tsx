"use client";

import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";

interface JourneyEndpointFieldProps {
  label: string;
  tone: "teal" | "violet";
  musicId: number | null;
  /** 누르면 패널이 닫히고 확장 검색창이 그 칸을 채우도록 열린다 */
  onOpenComposer: () => void;
}

/** 여정 패널의 출발·도착 표시 줄. 패널은 결과를 보여줄 뿐이고, 고치는 건 확장 검색창에서 한다 (JOURNEY-01) */
export default function JourneyEndpointField({ label, tone, musicId, onOpenComposer }: JourneyEndpointFieldProps) {
  const { data } = useMusicDetailQuery(musicId);
  const dot = tone === "teal" ? "bg-teal shadow-[0_0_7px_#4fe3ce]" : "bg-violet shadow-[0_0_7px_#a67cff]";

  return (
    <button
      type="button"
      onClick={onOpenComposer}
      title="검색창에서 바꾸기"
      className="group flex w-full items-center gap-2.5 py-1 text-left"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-pill ${dot}`} />
      <span className="lbl w-6 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] transition-colors group-hover:text-teal">
        {musicId == null ? <span className="text-ink-4">지정 안 됨</span> : (data?.title ?? `Track ${musicId}`)}
      </span>
      <span className="shrink-0 truncate text-[11px] text-ink-3">{data?.artist ?? ""}</span>
    </button>
  );
}
