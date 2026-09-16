import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, PLAYBACK_BLOCKED, QUERY_KEYS, type PlaybackBlocked } from "@/constants";
import type { VideoIdLookup } from "@/types";

interface VideoIdResult {
  musicId: number;
  /** 사이트 안에서 틀 수 있는 영상. `lookup` 이 `found` 일 때만 채워진다 */
  videoId: string | null;
  /** 검색이 어디까지 갔는가. `"없다"` 와 `"모른다"` 를 가른다 (S15P21A405-332) */
  lookup: VideoIdLookup;
}

/**
 * 곡 하나의 `videoId` (SONG-03, S15P21A405-340).
 *
 * **한 곡씩만 부른다.** 백엔드 조회는 DB 에 없으면 외부 API 를 호출해 채우는 동작이라 여러 곡을
 * 한꺼번에 치면 그만큼 비싸다. 곡 상세를 열거나 그 곡을 틀 때만 필요하므로 그때 한 번 받는다.
 *
 * 캐시가 곡별로 나뉘어 있어서, 같은 곡을 여러 화면(상세·플레이어바·임베드)이 동시에 물어도
 * 요청은 한 번만 나간다. `staleTime` 을 길게 잡는다 — 한 곡의 영상이 세션 중에 바뀔 일이 없다.
 */
export function useVideoIdQuery(musicId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.music.videoId(musicId ?? -1),
    queryFn: () => api<VideoIdResult>(API_ENDPOINTS.music.videoId(musicId!)),
    enabled: musicId != null,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * **이 곡을 지금 들을 수 있나, 못 들으면 뭐라고 말할까** (S15P21A405-364).
 *
 * 재생 가능 여부는 `videoId` 하나로 갈리는데(S15P21A405-326) 그 판단이 플레이어바·곡 상세·
 * 상세 헤더에 따로 적혀 있었다. 셋 다 `data` 가 없으면 "틀 수 있는 곡" 으로 보고 있어서,
 * **조회가 실패하면 버튼이 멀쩡한 채 눌러도 소리가 안 나고 아무 안내도 없었다** — 여정에서
 * 곡이 조용히 지나가는 것으로 보였다. 규칙을 여기 하나로 모아 세 곳이 같은 답을 받게 한다.
 *
 * **아직 모르는 동안(`pending`)에는 막지 않는다.** 도착하면 그때 판정이 잡힌다 — 여기서 미리
 * 막으면 곡을 열 때마다 잠깐씩 `재생 불가` 가 스쳐 지나간다.
 */
export function usePlayability(musicId: number | null): { canPlay: boolean; blocked: PlaybackBlocked | null; retry: () => void } {
  const { status, data, refetch } = useVideoIdQuery(musicId);

  /** 막힌 이유가 다시 시도해볼 만한 것이면 버튼을 누를 때 한 번 더 물어본다 */
  const retry = () => void refetch();

  if (status === "error") return { canPlay: false, blocked: PLAYBACK_BLOCKED.lookupFailed, retry };
  if (status === "success" && data.lookup === "notFound") return { canPlay: false, blocked: PLAYBACK_BLOCKED.noVideo, retry };
  if (status === "success" && data.lookup === "unsearched") return { canPlay: false, blocked: PLAYBACK_BLOCKED.notSearched, retry };
  return { canPlay: true, blocked: null, retry };
}
