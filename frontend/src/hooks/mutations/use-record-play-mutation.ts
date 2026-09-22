import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { sendJoinNow } from "@/hooks/use-presence-join";
import { ApiError } from "@/lib/api";
import { useMapStore } from "@/stores/use-map-store";
import type { PlayRequest, PlayResponse } from "@/types";

/**
 * 재생 선언 (S15P21A405-482, 실시간 작업명세 §4.1).
 *
 * **재생은 내 위치 이동의 유일한 원본이다.** 이 호출을 해야 내 표식이 그 곡으로 날아가고
 * 남들 화면에도 내 이동이 나타난다. 좌표는 보내지 않는다 — 곡 ID 만 주면 자리는 서버가 정한다.
 *
 * `layer` 를 **항상 넣는다.** 이미 지도에 서 있으면 무시되고, 아직 없으면 이 값으로 첫 자리를
 * 잡는다. 빠뜨리면 첫 배치에서 422 다.
 *
 * **422 는 presence 가 만료됐다는 뜻일 때가 많다** (§12.1). 백그라운드 탭에서 heartbeat 가
 * 늘어져 만료된 상태로 재생을 누르면 실측에서 422 가 났다. 그래서 두 겹으로 막는다 —
 * 부르기 **전에** join 을 한 번 보내고, 그래도 422 면 join 재전송 후 **한 번만** 재시도한다.
 * 그 뒤에도 실패하면 그때 호출자에게 던진다.
 */
export function useRecordPlayMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlayRequest): Promise<PlayResponse> => {
      // presence 가 살아 있어야 200 이 온다. 만료 상태에서 누르면 422 라 미리 깨워 둔다
      sendJoinNow(input.layer);
      try {
        return await post(input);
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "PRESENCE_ERROR") throw e;
        // 자동 복구는 한 번뿐이다. 반복하면 사용자는 아무것도 모른 채 기다리기만 한다
        sendJoinNow(input.layer);
        return await post(input);
      }
    },
    /**
     * **틀었으면 그 곡의 재생수가 바로 올라야 한다** (S15P21A405-573).
     *
     * 곡 상세는 `staleTime: Infinity` 다 (S15P21A405-514). 그 이유는 지금도 맞다 — 제목·
     * 아티스트·주성분 16개·가까운 10곡은 세션 중에 안 바뀐다. **그런데 `playCnt` 는 바뀌고,
     * 심지어 내가 눌러서 바뀐다.** `invalidateQueries` 는 `staleTime` 을 무시하고 다시 받으므로
     * 514 가 막아 둔 것(같은 곡 26번 조회)은 그대로 두고 **방금 튼 곡 하나만** 새로 받는다.
     *
     * 자리가 여기인 이유는 S15P21A405-569 다. 선언이 한 곳으로 모여서 큐 자동 넘김·여정·
     * 플리·주변 탐색이 전부 이 `onSuccess` 를 탄다. 호출부마다 붙일 일이 아니다.
     *
     * 남이 튼 것은 여전히 안 보인다 — 내가 안 누르면 무효화할 계기가 없다. 소켓이 필요한 일이고
     * 곡 상세의 재생수에 그만한 값어치가 있는지는 별개 판단이다.
     */
    onSuccess: (res, input) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.music.detail(input.musicId) });
      /**
       * **이 응답이 내 자리의 최신 근거다** (S15P21A405-579).
       *
       * 그동안 `myMusicId` 를 채우는 통로는 소켓의 `PRESENCE_JOINED` 하나뿐이었다. 그런데 그
       * 요청은 여기 `mutationFn` 이 재생 POST **직전에** 보낸다 — presence 를 깨우려는 것이라
       * 순서가 그렇다. 서버는 아직 재생을 모르니 "이미 서 있는 자리", 곧 **직전 곡**을 돌려준다.
       * 그래서 내 위치가 구조적으로 한 곡씩 뒤처졌다.
       *
       * S15P21A405-565 가 그 늦은 답을 걸러 내기는 한다. 다만 **옛 값을 버릴 뿐 새 값을 채우지
       * 않아서**, 걸러진 뒤에도 내 위치는 여전히 직전 곡이었다. 서버가 자리를 잡은 뒤의 답인
       * 이 값을 넣어야 비로소 맞는다.
       *
       * `input.musicId` 가 아니라 **응답의 `musicId`** 를 쓴다. 어디에 서게 됐는지는 서버가
       * 정한다 (실시간 명세 §4.1).
       *
       * 비행 연출은 안 깨진다. `setMyMusicId` 가 표식을 그 곡에 놓지만, 날아가는 중이면 다음
       * 프레임이 호 위 좌표로 다시 덮어쓰고 그림은 프레임 안에서만 그려진다.
       */
      useMapStore.getState().setMyMusicId(res.musicId);
    },
  });
}

const post = (body: PlayRequest) => api<PlayResponse>(API_ENDPOINTS.music.play, { method: "POST", body: JSON.stringify(body) });
