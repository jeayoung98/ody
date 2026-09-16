"use client";

import dynamic from "next/dynamic";
import { TEST_TOOLS } from "@/constants";

/**
 * 설문 마운트 지점 (S15P21A405-250).
 *
 * ## 걷어내는 법 — 명령 두 줄이 전부다
 *
 * ```bash
 * rm -rf src/components/survey src/hooks/survey src/stores/use-survey-store.ts \
 *        src/constants/survey.ts src/types/survey.ts src/lib/anonymous-id.ts src/app/bff/feedback
 * grep -rl REMOVE-WITH-SURVEY --exclude-dir=node_modules --exclude-dir=.next . \
 *   | xargs sed -i '/REMOVE-WITH-SURVEY/d'
 * ```
 *
 * 위 파일들은 **전부 설문 전용**이라 다른 데서 안 쓴다. 폴더째 지우므로 설문 파일이 늘어도
 * 이 명령은 그대로다. 설문 바깥에 남는 자리는 `REMOVE-WITH-SURVEY` 표식으로 찾는다 —
 * **표식 없는 자리를 만들지 않는다.** `tsconfig.json` 의 한 줄도 그 표식으로 같이 지워진다.
 *
 * 공용 상수(`query-keys` `api-endpoints`)·스토어·`lib/api` 통로에는 설문이 한 글자도 없다.
 * 의존은 한 방향이라 설문이 기존 것을 **읽기만** 한다. 지워도 나머지가 깨지지 않는다.
 *
 * 딱 하나 기존 코드가 아는 자리가 `use-blocking-store` 의 `gate` 다 (S15P21A405-335).
 * 재생 코드는 거기 꽂힌 것이 **무엇인지 모른 채** 부르기만 하고, 설문을 지우면 아무도 안 꽂아
 * 늘 null 이라 전부 그냥 지나간다. 그 파일은 지우지 않아도 되고, 지워도 되는 자리가 아니다.
 *
 * 본체를 **동적으로 불러온다** — 꺼진 빌드에서는 설문 코드가 초기 번들에 들어가지 않고
 * 받아오지도 않는다. 정적 import 로 두면 화면에 안 보여도 코드는 그대로 실린다.
 *
 * `ssr: false` 인 이유: 설문은 localStorage(익명 ID)와 브라우저 상태에 기대므로
 * 서버에서 그릴 것이 없다.
 *
 * 스위치는 [`TEST_TOOLS`](../../constants/test-tools.ts) 다 (S15P21A405-368). 예전에는 설문만
 * `NEXT_PUBLIC_SURVEY_ENABLED` 라는 제 스위치를 들고 **기본 꺼짐**이었는데, Jenkins 가
 * `NEXT_PUBLIC_*` 을 주입하지 않아 **배포본에서 켜질 경로 자체가 없었다.**
 */
const SurveyRunner = dynamic(() => import("./survey-runner"), { ssr: false });

export default function SurveyGate() {
  if (!TEST_TOOLS) {
    /**
     * 왜 안 뜨는지 한 줄은 남긴다 (S15P21A405-368). 여기서 끝나면 설문 코드는 받아오지도 않아서
     * 아무 흔적이 없다 — "기능이 빠졌나" 와 "스위치가 꺼졌나" 를 구분할 수 없었다.
     *
     * **`survey-log` 를 import 하지 않고 여기 적는다.** 이 파일은 정적으로 실려서, 모듈을 하나
     * 더 끌어오면 꺼진 빌드에도 설문 폴더가 번들에 들어간다 — `dynamic` 을 쓰는 이유가 사라진다.
     */
    if (process.env.NODE_ENV !== "production") console.info("%c[ODY 설문] 꺼짐%c NEXT_PUBLIC_TEST_TOOLS=0 이라 설문을 불러오지 않는다", "color:#93a4c4;font-weight:600", "color:inherit");
    return null;
  }
  return <SurveyRunner />;
}
