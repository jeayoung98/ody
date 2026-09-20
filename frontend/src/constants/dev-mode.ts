/**
 * **개발 버전을 URL 로 연다** (S15P21A405-421).
 *
 * 배포본에서 팀원이 개발 버전을 보는 길은 [`useSurveyMode`](../hooks/use-survey-mode.ts) 하나였고,
 * 브라우저 콘솔에 직접 쳐야 했다.
 *
 * ```js
 * localStorage.setItem("ody:survey-mode", "false"); location.reload();
 * ```
 *
 * **폰에서는 이게 안 된다.** 개발자도구가 없다. USB 로 원격 디버깅을 붙이는 방법이 있지만
 * iOS 는 Mac 이 있어야 하고, 안드로이드도 화면 하나 보려고 선을 꽂는 건 현실적이지 않다.
 *
 * 그래서 주소로 켠다.
 *
 * ```text
 * ?dev=1   설문을 끄고 좁은 화면 게이트를 넘는다
 * ?dev=0   둘 다 되돌린다
 * ```
 *
 * 폰에서 한 번만 치면 이후로는 파라미터 없이 들어가도 유지된다.
 *
 * ## 스위치가 하나인 이유
 *
 * 원래는 `?gate` 가 따로 있었다 (S15P21A405-483 에서 합쳤다). 나눈 이유는 로그인 하나였다 —
 * 설문 모드를 끄면 로그인 게이트가 살아나서(S15P21A405-459), 스위치가 하나뿐이면 폰에서 화면
 * 한 번 보려고 매번 로그인해야 했다. 그래서 "게이트만 넘고 설문 모드는 그대로" 인 길을 뒀다.
 *
 * **S15P21A405-480 이 그 전제를 없앴다.** 설문 모드는 이제 설문만 가르고, 로그인은 모드와
 * 상관없이 항상 필요하다. 감춰 둔 기능도 없다(전부 켜짐). 그러니 둘을 나눠 봐야 차이가
 * "설문 화면이 뜨느냐" 뿐이고, 이름이 둘이면 어느 쪽을 써야 하는지가 안 읽힌다.
 *
 * ## 저장소 키는 둘로 둔다
 *
 * 스위치는 하나지만 `ody:survey-mode` 와 `ody:gate-off` 는 따로 쓴다. 게이트 우회를 제 키에
 * 담아 두면 S15P21A405-419 에서 게이트를 걷어낼 때 **지울 것이 한 줄로 분명해진다.** 설문
 * 모드에 얹어 두면 그때 두 뜻이 엉킨 키를 풀어야 한다.
 *
 * 게이트를 굳이 스위치로 넘기는 이유는 `globals.css` 의 `.small-screen-gate` 가 순수 CSS 라
 * 폰에서 끌 방법이 달리 없어서다.
 *
 * ## 왜 인라인 스크립트인가
 *
 * 번들이 로드된 뒤에 켜면 **첫 페인트에 게이트가 한 번 보였다가 사라진다.** `<head>` 안에서
 * 막고 도는 스크립트라야 그리기 전에 클래스가 붙는다. 같은 이유로 React 컴포넌트가 아니다.
 *
 * ## 이 스위치가 비밀은 아니다
 *
 * 브라우저에 내려가는 코드는 비밀을 못 가진다. 파라미터 이름도 저장소 키도 번들 안에 문자열로
 * 들어 있고, 개발자도구를 여는 사람은 지금도 `localStorage` 한 줄로 같은 걸 할 수 있다.
 * 이 스위치가 막는 것은 **주소만 보고 따라 들어오는 것**까지다.
 *
 * **진짜로 감추는 길은 빌드 스위치 하나뿐이다.** `NEXT_PUBLIC_TEST_TOOLS=0` 으로 빌드하면
 * 이 스크립트가 `layout.tsx` 에서 아예 안 실린다 — URL 로도 저장소로도 되살릴 수 없다.
 */

// 배럴(@/constants)이 아니라 정의 파일에서 직접 받는다 — 이 파일도 배럴이 모으는 대상이라 순환이 된다
import { STORAGE_KEYS } from "./storage-keys";

/** 개발 버전 스위치. `?dev=1` 켜기, `?dev=0` 끄기 — 설문과 게이트를 한꺼번에 뒤집는다 */
export const DEV_MODE_PARAM = "dev";

/**
 * 켜졌을 때 `<html>` 에 붙는 클래스. 게이트를 덮는 규칙이 `globals.css` 에 있고,
 * `html.ody-dev .small-screen-gate` 라 특이도가 높아 미디어 쿼리보다 항상 이긴다.
 */
export const DEV_MODE_CLASS = "ody-dev";

/**
 * `<head>` 에서 막고 도는 인라인 스크립트. **번들이 아니라 문자열로 나간다.**
 *
 * 저장소 규칙은 [`lib/storage.ts`](../lib/storage.ts) 를 그대로 따른다 — 쓸 때는 local 에 넣고
 * session 의 같은 키를 지우며(안 지우면 읽는 순서 때문에 옛 값이 살아난다), 지울 때는 둘 다 지운다.
 *
 * 전부 `try` 안에 있다. 시크릿 모드처럼 저장소가 막힌 브라우저에서 예외가 나면 **앱이 뜨기도 전에
 * 죽는다.** 실패하면 그냥 아무 일도 안 한 것이 된다.
 */
export const devModeScript = `(function(){try{
var K="${STORAGE_KEYS.surveyMode}",G="${STORAGE_KEYS.gateOff}",u=new URL(location.href);
var d=u.searchParams.get("${DEV_MODE_PARAM}");
if(d!==null){
var on=d!=="0";
[K,G].forEach(function(k){if(on){localStorage.setItem(k,"false");}else{localStorage.removeItem(k);}sessionStorage.removeItem(k);});
u.searchParams.delete("${DEV_MODE_PARAM}");
history.replaceState(null,"",u.pathname+u.search+u.hash);
}
function off(k){return localStorage.getItem(k)==="false"||sessionStorage.getItem(k)==="false";}
document.documentElement.classList.toggle("${DEV_MODE_CLASS}",off(K)||off(G));
}catch(e){}})();`;
