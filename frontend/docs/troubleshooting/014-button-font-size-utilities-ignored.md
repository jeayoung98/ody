# 014. 버튼 글씨 크기 클래스가 전부 무시됨

- 이슈: S15P21A405-384
- 커밋 / MR: (이 문서와 같은 커밋)
- 날짜: 2026-09-16

## 증상

곡 상세의 `여정 출발점으로` 버튼 글씨를 줄여 달라는 요청을 받고 `text-2xs`(9.5px)를 줬는데
**화면이 그대로였다.** 다시 줄여 달라는 요청이 와서 `text-3xs`(8.5px)로 더 줄였는데도 그대로였다.

1. `<Button size="sm" className="text-2xs">` 로 고친다
2. 브라우저를 새로고침한다
3. → 글씨 크기가 하나도 안 변한다

버튼만 그렇다. 같은 클래스를 `<span>` 에 주면 잘 먹는다.

## 처음 의심한 것 (틀렸다)

**새로 추가한 토큰(`--text-3xs`)이 유틸리티로 안 만들어졌다**고 봤다. Tailwind 4 의 `@theme` 에
값을 넣어도 dev 서버가 다시 훑지 않으면 클래스가 안 나오는 일이 있어서다.

아니었다. 토큰은 멀쩡히 나왔고 **`div` 에는 잘 먹었다.** 아래 증거의 `div3xs` 를 보면 8.5px 이다.

## 증거

브라우저 콘솔에서 같은 클래스를 태그만 바꿔 세 번 재 봤다.

```js
const d=document.createElement('div');    d.className='text-3xs'; document.body.appendChild(d);
const s=document.createElement('span');   s.className='text-xs';  document.body.appendChild(s);
const b=document.createElement('button'); b.className='text-xs';  document.body.appendChild(b);
({div3xs:getComputedStyle(d).fontSize, spanXs:getComputedStyle(s).fontSize, buttonXs:getComputedStyle(b).fontSize})
```

```
{ div3xs: "8.5px", spanXs: "10.5px", buttonXs: "16px" }
```

`div` · `span` 은 먹고 **`button` 만 16px(상속값)** 이다. 클래스 문제가 아니라 태그 문제다.

## 원인

[`src/app/globals.css`](../../src/app/globals.css) 의 기본 블록이 **`@layer` 밖**에 있었다.

```css
@import "tailwindcss";

button {
  font: inherit;   /* ← 레이어 밖 */
  color: inherit;
  cursor: pointer;
}
```

CSS 레이어 규칙에서 **레이어에 속하지 않은 선언은 레이어 안의 선언을 언제나 이긴다.** 우선순위
계산과 무관하다. Tailwind 4 는 유틸리티를 `@layer utilities` 안에 넣으므로, 레이어 밖의
`button { font: inherit }` 가 `.text-xs` 를 **항상** 눌렀다. 그래서 버튼 글씨는 클래스와 상관없이
늘 상속값(대개 16px)이었다.

`font: inherit` 자체는 필요한 코드다 — 브라우저가 버튼에 주는 기본 글꼴(맑은 고딕 등)을 지우려는
것이고, 프로토타입 CSS 에서 그대로 옮겨 왔다. 그때는 Tailwind 레이어가 없었으니 문제가 안 됐다.

## 조치

기본 블록(`html/body`, `button`, `input`, `:focus-visible`)을 **`@layer base` 로 감쌌다.**
선언은 한 글자도 바꾸지 않았다. 레이어에 들어가는 순간 유틸리티(`utilities` 레이어가 뒤)가 이긴다.

`::-webkit-scrollbar` 규칙은 겹치는 유틸리티가 없어 그대로 뒀다.

## 확인

| 시나리오 | 결과 |
| --- | --- |
| `button.text-xs` 계산값 | 16px → **10.5px** |
| `여정 출발점으로` 에 준 글씨 크기 클래스 | 무시됨(16px) → **클래스 값 그대로 적용됨** |
| `경로 만들기` 등 `Button size="md"` (`text-sm`) | 16px → 12px. 여정 만들기 창에서 눈으로 확인 |
| 버튼 글꼴 | `IBM Plex Sans KR` 유지 (`font: inherit` 그대로) |
| `npm run lint` · `tsc` · `build` · `test` | 통과 (61 pass) |

앱 전체의 버튼 글씨가 **한꺼번에 설계값으로 줄어든다.** 고친 게 곡 상세 하나가 아니라는 뜻이라
되돌릴 일이 생기면 이 커밋만 되돌리면 된다.

## 배운 것

**"클래스를 줬는데 아무 일도 안 일어난다" 면 클래스가 안 만들어진 것부터 의심하지 말고,
같은 클래스를 다른 태그에 붙여 본다.** 태그마다 다르면 범인은 요소 선택자이고, 그게 레이어 밖에
있으면 우선순위로는 절대 못 이긴다. Tailwind 4 프로젝트에서 전역 리셋을 쓸 때는 `@layer base`
안에 두는 것이 기본이다.
