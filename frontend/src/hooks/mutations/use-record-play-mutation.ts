import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/constants";
import { joinAndWait } from "@/hooks/use-presence-join";
import { ApiError } from "@/lib/api";
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
 * 부르기 **전에** join 을 보내 **응답까지 기다리고**, 그래도 422 면 한 번 더 기다린 뒤
 * **한 번만** 재시도한다. 그 뒤에도 실패하면 그때 호출자에게 던진다.
 *
 * 기다리는 것이 핵심이다 (S15P21A405-555). 던지고 바로 REST 를 부르면 서버가 join 을 처리하기
 * 전에 요청이 닿아, 깨우려던 그 만료 상태 그대로 422 가 난다.
 */
export function useRecordPlayMutation() {
  return useMutation({
    mutationFn: async (input: PlayRequest): Promise<PlayResponse> => {
      // presence 가 살아 있어야 200 이 온다. **응답을 기다린다** (S15P21A405-555)
      await joinAndWait(input.layer);
      try {
        return await post(input);
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "PRESENCE_ERROR") throw e;
        // 자동 복구는 한 번뿐이다. 반복하면 사용자는 아무것도 모른 채 기다리기만 한다
        await joinAndWait(input.layer);
        return await post(input);
      }
    },
  });
}

const post = (body: PlayRequest) => api<PlayResponse>(API_ENDPOINTS.music.play, { method: "POST", body: JSON.stringify(body) });
