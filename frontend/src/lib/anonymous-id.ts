/**
 * 익명 사용자 ID (S15P21A405-250).
 *
 * 1차 배포는 로그인 없이 들어온다. 설문 응답을 "같은 사람의 것"으로 묶으려면 식별자가
 * 필요한데, **백엔드가 발급할 필요가 없다** — 브라우저가 만들어 보관하고 요청마다 보내면
 * 백엔드는 문자열로 저장만 하면 된다.
 *
 * 한계는 감안하고 쓴다: 저장소를 지우거나 시크릿 모드면 새 ID 가 된다. 기기가 바뀌어도
 * 다른 사람으로 잡힌다. 설문 집계용으로는 충분하다.
 *
 * `refresh_token.deviceId` 와는 다른 것이다 — 그건 로그인한 사용자의 멀티 세션 구분용이다.
 *
 * **최종 배포 때 걷어낼 기능이다.** survey 관련 파일과 함께 삭제된다.
 */
import { readStorage, writeStorage } from "./storage";

const KEY = "ody:anonymous-id";

/** 구형 브라우저·비보안 컨텍스트에서 randomUUID 가 없을 때의 폴백 */
function fallbackId(): string {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 익명 ID 를 돌려준다. 없으면 만들어 저장한다.
 * 서버에서 부르면 빈 문자열 — localStorage 가 없으므로 식별할 방법이 없다.
 */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";

  const saved = readStorage<string>(KEY);
  if (saved) return saved;

  const id = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : fallbackId();
  writeStorage(KEY, id);
  return id;
}
