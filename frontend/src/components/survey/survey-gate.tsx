"use client";

import dynamic from "next/dynamic";

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
 * 본체를 **동적으로 불러온다** — `NEXT_PUBLIC_SURVEY_ENABLED` 가 꺼진 빌드에서는
 * 설문 코드가 초기 번들에 들어가지 않고 받아오지도 않는다. 정적 import 로 두면
 * 화면에 안 보여도 코드는 그대로 실린다.
 *
 * `ssr: false` 인 이유: 설문은 localStorage(익명 ID)와 브라우저 상태에 기대므로
 * 서버에서 그릴 것이 없다.
 */
const ENABLED = process.env.NEXT_PUBLIC_SURVEY_ENABLED === "true";

const SurveyRunner = dynamic(() => import("./survey-runner"), { ssr: false });

export default function SurveyGate() {
  if (!ENABLED) return null;
  return <SurveyRunner />;
}
