"use client";

import { useCallback, useState } from "react";
import { CONTEST_SAVE_DUPLICATED } from "@/constants";
import { useSaveContestEntryMutation } from "@/hooks/mutations/use-save-contest-entry-mutation";
import { ApiError } from "@/lib/api";
import { useToastStore } from "@/stores/use-toast-store";
import type { ContestEntry } from "@/types";

/**
 * 작품을 내 플리로 가져오기 (S15P21A405-640 · 702). 갤러리 카드와 순위 탭이 같이 쓴다.
 *
 * 넣은 작품은 버튼을 꺼 둔다 — 두 번 누르면 같은 플리가 둘 생길 뻔했다. 백엔드가 같은 이름의 플리를 막아
 * 두 번째는 409 `PLAYLIST_NAME_DUPLICATED` 로 오는데, 그때도 "이미 있다" 고 말하고 끈다.
 * 꺼진 상태는 이 화면이 떠 있는 동안만 기억한다 — 작품 기준으로 이미 가져왔는지는 백엔드가 알려 줘야 한다(A-92).
 */
export function useSaveContestToPlaylist(loggedIn: boolean) {
  const toast = useToastStore((s) => s.show);
  const mutation = useSaveContestEntryMutation();
  const [saved, setSaved] = useState<ReadonlySet<number>>(() => new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const mark = (id: number) => setSaved((prev) => new Set(prev).add(id));

  const save = useCallback(
    (e: ContestEntry) => {
      if (!loggedIn) return toast("로그인하면 내 플레이리스트로 가져올 수 있어요");
      if (saved.has(e.artworkId)) return toast(CONTEST_SAVE_DUPLICATED);
      setSavingId(e.artworkId);
      mutation.mutate(
        { playlistName: e.title, musicIds: e.tracks.map((t) => t.musicId) },
        {
          onSuccess: () => {
            mark(e.artworkId);
            toast(`「${e.title}」 곡 ${e.tracks.length}개를 내 플레이리스트에 넣었어요 · 순서 그대로`);
          },
          onError: (err) => {
            if (err instanceof ApiError && err.code === "PLAYLIST_NAME_DUPLICATED") {
              mark(e.artworkId);
              return toast(CONTEST_SAVE_DUPLICATED);
            }
            toast(err.message);
          },
          onSettled: () => setSavingId(null),
        },
      );
    },
    [loggedIn, saved, mutation, toast],
  );

  return { save, isSaved: (id: number) => saved.has(id), savingId };
}
