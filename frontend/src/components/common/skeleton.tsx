/**
 * 불러오는 동안 자리만 잡아 두는 회색 덩어리 (S15P21A405-384).
 *
 * 글자로 "불러오는 중…" 이라고 적는 것보다, **올 것의 모양을 미리 깔아 두는 쪽**이 기다림을
 * 짧게 느끼게 한다 — 화면이 비었다가 통째로 나타나면 한 번 더 놀란다.
 *
 * **똑같이 베끼지 않는다.** 줄 수와 길이를 대충 맞춘 줄글이면 충분하고, 오히려 실제와 1:1로
 * 맞추면 값이 채워질 때 미세하게 어긋나는 것이 더 눈에 띈다.
 */
export default function Skeleton({ w = "100%", h = 12, rounded = "pill", className = "" }: { w?: number | string; h?: number; rounded?: "pill" | "box"; className?: string }) {
  return <span aria-hidden style={{ width: w, height: h }} className={`skel block shrink-0 ${rounded === "pill" ? "rounded-pill" : "rounded-box-sm"} ${className}`} />;
}
