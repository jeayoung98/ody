"use client";

import type { ReactNode } from "react";
import { PODIUM } from "@/constants";
import { ownerLabel } from "@/lib/contest-view";
import type { ContestEntry } from "@/types";
import ConstellationThumb from "./constellation-thumb";
import LikeHeart from "./like-heart";

interface RankingPodiumProps {
  /** 순위순 상위 3개 (모자라면 있는 만큼) */
  top: ContestEntry[];
  meEmail: string | null;
  onLike: (e: ContestEntry) => void;
  canLike: (e: ContestEntry) => boolean;
  likePending: boolean;
  /** 내 플리로 가져오기 버튼 — 넣었는지 여부는 순위 탭이 목록과 함께 들고 있다 */
  saveButton: (e: ContestEntry) => ReactNode;
}

/**
 * 순위 1~3위 시상대 (S15P21A405-702). 가운데가 1위, 좌우가 2·3위이고 그림 크기로 순위가 먼저 읽힌다.
 * 한 줄 목록일 때는 상위권이 4위와 똑같이 생겨 눈에 안 띄었다. 좋아요는 여기서 바로 준다.
 */
export default function RankingPodium({ top, meEmail, onLike, canLike, likePending, saveButton }: RankingPodiumProps) {
  const slots = PODIUM.order.map((i) => ({ entry: top[i] ?? null, place: i }));
  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {slots.map(({ entry, place }) => {
        if (!entry) return <div key={place} />;
        const first = place === 0;
        const isMine = meEmail != null && entry.ownerEmail === meEmail;
        return (
          <article
            key={entry.artworkId}
            className={`flex flex-col items-center gap-2 rounded-box-sm border p-3 text-center ${first ? "border-teal/45 bg-teal/[.06]" : "border-line bg-white/[.03]"}`}
          >
            <span className={`num text-sm font-semibold ${first ? "text-teal" : "text-ink-2"}`}>{place + 1}위</span>
            <ConstellationThumb tracks={entry.tracks} closed={entry.closed} size={PODIUM.thumbPx[place]} />
            <p className="w-full truncate text-sm font-medium">{entry.title}</p>
            <p className="w-full truncate text-xs text-ink-3">
              @{ownerLabel(entry.ownerEmail, entry.ownerNickname)}
              {isMine && " · 나"}
            </p>
            <p className="num text-xs text-ink-3">
              AI {entry.score ?? "–"} · 순위 점수 <b className="text-ink">{entry.rankScore?.toFixed(1) ?? "–"}</b>
            </p>
            <div className="flex items-center gap-1.5">
              <LikeHeart
                entry={entry}
                disabled={!canLike(entry) || likePending}
                title={isMine ? "내 작품에는 좋아요를 줄 수 없어요" : entry.likedByMe ? "좋아요 거두기" : "좋아요"}
                onClick={() => onLike(entry)}
              />
              {saveButton(entry)}
            </div>
          </article>
        );
      })}
    </div>
  );
}
