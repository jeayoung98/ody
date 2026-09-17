/**
 * 익명 사용자 식별자 (S15P21A405-294).
 *
 * 1차 배포는 로그인을 태우지 않는다. 그러면 설문 응답이 전부 `user_email = NULL` 로 쌓여서
 * **응답 100건이 10명에게서 나온 것인지 1명에게서 나온 것인지 알 수 없다.** 정밀도의 분모가
 * 사라지는 셈이라, 한 사람이 몰아서 찍은 편향을 걸러낼 수도 없다.
 *
 * 그래서 브라우저마다 UUID 를 하나 만들어 보관한다. 키 이름은 정본이 지정한 값이다
 * (`docs/api-spec.md` 5.1 — `localStorage["ody_anon_id"]`).
 *
 * 로그인 사용자도 함께 보낸다 — 로그인 전후 응답을 잇는 데 쓴다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
import { SURVEY_ANON_KEY } from "@/constants/survey";
let memoryId: string | undefined;

/**
 * 이 브라우저의 익명 ID. 없으면 만들어 저장한다.
 *
 * 저장소가 막히면 문서가 살아 있는 동안 메모리 ID를 공유한다.
 */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();

  try {
    const saved = localStorage.getItem(SURVEY_ANON_KEY);
    if (saved) return saved;
    const created = memoryId ??= crypto.randomUUID();
    localStorage.setItem(SURVEY_ANON_KEY, created);
    return created;
  } catch {
    return memoryId ??= crypto.randomUUID();
  }
}
