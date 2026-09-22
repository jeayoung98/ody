import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistDetail } from "@/types";

/** 백엔드 `PlaylistMusicReorderResponse` */
interface ReorderResult {
  playlistId: number;
  musicCnt: number;
}

interface Input {
  playlistId: number;
  /** **새 순서의 전체 목록.** 바뀐 곡만이 아니다 — 백엔드가 이 배열 그대로 다시 매긴다 */
  musicIds: number[];
}

/**
 * 한 칸 옮긴 목록을 만든다 (S15P21A405-540).
 *
 * 훅 밖에 둔 것은 **시험하려고**다. 배열 한 줄짜리로 보이지만 경계에서 조용히 틀리기 쉽다 —
 * 범위를 벗어난 자리로 옮기면 `splice` 가 아무 말 없이 맨 끝에 붙이거나 `undefined` 를 끼워
 * 넣는다. 그러면 서버에 **곡이 하나 빠진 목록**이 올라간다.
 *
 * @returns 옮긴 새 배열. 옮길 수 없는 자리면 원래 배열을 그대로 (참조까지 같게) 돌려준다
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return list;
  if (from < 0 || from >= list.length) return list;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * 플리 곡 순서 바꾸기 (S15P21A405-540).
 *
 * **눈에 먼저 반영한다.** 서버를 다녀온 뒤에 그리면 한 칸 옮기는 데 왕복이 보인다 — 연속으로
 * 두어 번 누르면 목록이 뒤늦게 따라오며 튄다. 그래서 캐시를 먼저 바꾸고, 실패하면 되돌린다.
 *
 * **재생 중인 큐는 건드리지 않는다.** 큐는 "지금 틀고 있는 차례" 라서, 듣는 도중에 순서가 바뀌면
 * 다음 곡이 말없이 달라진다. 바뀐 순서는 다음에 이 플리를 재생할 때부터 적용된다.
 */
export function useReorderPlaylistItemsMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, musicIds }: Input) =>
      api<ReorderResult>(API_ENDPOINTS.playlist.order(playlistId), { method: "PATCH", body: JSON.stringify({ musicIds }) }),

    onMutate: async ({ playlistId, musicIds }) => {
      const key = QUERY_KEYS.playlist.detail(playlistId);
      // 돌고 있던 조회가 뒤늦게 끝나면 방금 그린 순서를 옛것으로 덮는다
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PlaylistDetail>(key);
      if (previous) {
        const byMusicId = new Map(previous.items.map((it) => [it.musicId, it]));
        const items = musicIds.map((id) => byMusicId.get(id)).filter((it): it is NonNullable<typeof it> => it != null);
        // 아는 곡만 남았는데 수가 줄었다면 목록이 그 사이 바뀐 것이다 — 그때는 손대지 않고 조회에 맡긴다
        if (items.length === previous.items.length) qc.setQueryData<PlaylistDetail>(key, { ...previous, items });
      }
      return { previous };
    },

    onError: (_error, { playlistId }, context) => {
      // 되돌린다. 화면에는 바뀐 순서가 보이는데 서버는 옛 순서인 상태가 제일 나쁘다
      if (context?.previous) qc.setQueryData(QUERY_KEYS.playlist.detail(playlistId), context.previous);
    },

    onSettled: (_data, _error, { playlistId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
    },
  });
}
