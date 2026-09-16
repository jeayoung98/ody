/**
 * **좁은 화면에서는 화면을 덮고 데스크톱에서 쓰라고 안내한다** (S15P21A405-379).
 *
 * 이 앱은 데스크톱 전제로 만들어져 있다. 지도 위에 HUD 가 떠 있는 구성이라 좌측 레일·우측
 * 패널·하단 트랜스포트·계기판이 동시에 자리를 차지하는데, 좁으면 서로를 덮는다. 하단 바만 해도
 * `w-[min(640px,52vw)]` 라 1231px 아래에서부터 줄어든다.
 *
 * 반응형 대응은 따로 할 일이고, 그 전까지 **깨진 화면을 그냥 보여주지는 않는다** — 유저 테스트
 * 참가자가 폰으로 열면 무엇을 봐야 할지 모른다.
 *
 * ## 자바스크립트로 폭을 재지 않는다
 *
 * `window.innerWidth` 를 읽으면 두 가지가 깨진다. 서버 렌더에는 창 크기가 없어 값이 달라지므로
 * **하이드레이션이 어긋나고**, JS 가 뜨기 전 첫 페인트에서는 **깨진 화면이 그대로 보인다.**
 * 그래서 순수 CSS 미디어 쿼리로만 가른다 — 첫 페인트부터 맞고, JS 가 없어도 동작한다.
 *
 * ## 기준 폭
 *
 * **900px.** 그 아래로 내려가면 우측 패널과 지도가 같이 설 자리가 없다.
 *
 * 미디어 쿼리는 `globals.css` 의 `.small-screen-gate` 에 있다. Tailwind 유틸리티(`hidden
 * max-[899px]:flex`)로 뒀더니 특이도가 같아 **스타일시트 순서에서 `display:none` 이 이겼다** —
 * `matchMedia` 는 true 인데 화면에는 안 나왔다. 바꿀 때는 그 파일의 `899` 와 아래 문구의
 * "900px" 를 같이 고친다.
 */
export default function SmallScreenGate() {
  return (
    <div className="small-screen-gate fixed inset-0 z-[200] flex-col items-center justify-center gap-5 bg-void px-6 text-center">
      <span aria-hidden className="grad-text font-display text-[26px] leading-none font-semibold">
        ODY
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-[17px] leading-relaxed font-medium text-ink">데스크톱에서 열어 주세요</p>
        <p className="text-[13.5px] leading-relaxed text-ink-3">
          별지도는 화면을 넓게 쓰는 탐색 도구예요.
          <br />
          지금 창이 좁아서 지도와 패널이 함께 놓이지 않아요.
        </p>
      </div>
      {/* 무엇을 하면 되는지까지 적는다 — "안 된다" 만 있으면 고장으로 읽힌다 */}
      <p className="text-[12.5px] leading-relaxed text-ink-4">
        PC 브라우저에서 같은 주소로 들어오거나,
        <br />
        창을 900px 이상으로 넓혀 주세요.
      </p>
    </div>
  );
}
