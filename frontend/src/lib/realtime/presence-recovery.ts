import type { WebSocketErrorCode } from "@/types";

/**
 * presence 오류마다 **어떤 복구가 필요한가** (S15P21A405-555).
 *
 * 이 표가 파일 하나를 차지하는 이유는, 여기 빈칸이 하나 있었다는 것만으로 사용자가 새로고침
 * 전까지 지도에서 사라져 있었기 때문이다. 화면에 아무 표시도 나지 않고 오류도 안 뜬다 —
 * 남들 화면에만 안 보이므로 혼자 쓰면 평생 못 찾는다. 규칙을 밖으로 꺼내 테스트로 묶는다.
 *
 * - `reconnect` — **presence 행 자체가 없다.** 서버는 소켓 CONNECT 시점에만 그 행을 만들어서
 *   (`WebSocketConnectionListener.onConnected`), join 을 아무리 다시 보내도 같은 코드가 돌아온다.
 *   소켓을 끊었다 열어야 새 접속이 생긴다. 소켓은 멀쩡히 열려 있으므로 stompjs 가 알아서
 *   해 주지 않는다.
 * - `rejoin` — 행은 있는데 내 자리나 접속 번호가 어긋났다. join 한 번이면 맞춰진다.
 * - `none` — 복구할 것이 없다. `PRESENCE_NO_ANCHOR` 가 여기다. 첫 재생 전이라 지도에 놓을
 *   자리가 없는 정상 상태고, 재연결해도 재입장해도 달라지지 않는다 (§3.3).
 */
export type PresenceRecovery = "reconnect" | "rejoin" | "none";

export function recoveryFor(code: WebSocketErrorCode): PresenceRecovery {
  switch (code) {
    /**
     * **여기가 비어 있던 자리다.** heartbeat 가 만료를 알리면(`PRESENCE_STALE`) 프론트가 join 을
     * 보냈고, 그 join 이 이 코드로 튕겼는데 받는 곳이 없어 프레임이 그냥 버려졌다. 두 코드가
     * 서로를 부르며 도는 셈이라 빠져나올 길이 없었다.
     */
    case "PRESENCE_NOT_CONNECTED":
      return "reconnect";
    case "PRESENCE_STALE":
      return "rejoin";
    default:
      return "none";
  }
}
