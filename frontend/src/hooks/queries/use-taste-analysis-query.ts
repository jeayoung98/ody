import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { TasteAnalysis } from "@/types";

/** 생성 중일 때 다시 물어보는 간격(ms). 백엔드가 외부 생성을 기다리는 동안이다 */
const IN_PROGRESS_POLL_MS = 3000;

/**
 * 내 음악 취향 분석 (S15P21A405-630).
 *
 * **남의 것은 물어볼 수 없다.** 백엔드가 토큰으로 사람을 정하므로 이 훅에 인자가 없다 —
 * 남의 프로필 화면에서는 부르는 컴포넌트 자체가 서지 않는다 (`feed-panel` 의 `isMe && me`).
 * 로그인 전에도 세우지 않는다 — 그러면 401 이 확정된 요청을 프로필을 열 때마다 한 번씩 보낸다.
 *
 * **생성 중일 때만 다시 묻는다.** 리포트는 내가 버튼을 눌러야 생기고 하루 한 번뿐이라
 * 평소에는 저절로 바뀔 일이 없다. 다만 `IN_PROGRESS` 는 **다른 탭이나 이전 방문에서 눌러 둔
 * 것**일 수 있어서(백엔드가 lease 로 들고 있다) 그때는 끝나는 것을 보고 있어야 한다.
 *
 * `staleTime` 을 0 으로 둔 이유: 좋아요를 하고 돌아오면 `state` 가 `FRESH` → `STALE` 로 바뀐다.
 * 마이페이지를 다시 열 때 그 사실이 반영돼야 "다시 만들기" 를 권할 수 있다.
 */
export function useTasteAnalysisQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.taste.analysis,
    queryFn: () => api<TasteAnalysis>(API_ENDPOINTS.taste.analysis),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.state === "IN_PROGRESS" ? IN_PROGRESS_POLL_MS : false),
    /** 백그라운드 탭에서까지 물을 이유는 없다 — 돌아오면 그때 한 번 묻는다 */
    refetchIntervalInBackground: false,
  });
}
