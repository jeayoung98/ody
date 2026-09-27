import Skeleton from "./skeleton";

/**
 * 목록이 오는 동안의 자리 (S15P21A405-503). 곡 상세가 그러듯 (`song-detail-skeleton`)
 * **올 것의 모양**을 깔아 둔다 — 패널 대부분은 `.item` 줄(track-row · user-row · playlist-row)이
 * 쌓인 목록이라, 그 줄 하나의 뼈대만 있으면 거의 모든 패널을 덮는다.
 *
 * 줄 길이를 일부러 들쭉날쭉하게 돌린다. 같은 길이로 깔면 목록이 아니라 표처럼 보인다.
 * 실제와 1:1로 맞추지는 않는다 — 값이 올 때 미세하게 어긋나는 쪽이 더 눈에 띈다.
 */
const TITLE_W = ["72%", "54%", "81%", "63%", "45%"];
const SUB_W = ["38%", "47%", "29%", "41%", "34%"];

interface SkeletonRowsProps {
  /** 몇 줄 깔지. 실제로 올 개수를 모를 때는 화면을 채우는 만큼 */
  count?: number;
  /** 줄 앞머리 — 앨범/플리 네모, 프로필 동그라미, 없음(번호만 붙는 목록) */
  thumb?: "square" | "circle" | "none";
  /** 줄 오른쪽 끝의 숫자 자리 (재생수 · 좋아요 · 길이) */
  right?: boolean;
  /** 부제 줄. 한 줄짜리 목록(플리 고르기 메뉴)은 끈다 */
  sub?: boolean;
}

export default function SkeletonRows({ count = 5, thumb = "square", right = true, sub = true }: SkeletonRowsProps) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-[9px] py-2">
          {thumb !== "none" && <Skeleton w={36} h={36} rounded={thumb === "circle" ? "pill" : "box"} />}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton w={TITLE_W[i % TITLE_W.length]} h={11} />
            {sub && <Skeleton w={SUB_W[i % SUB_W.length]} h={9} />}
          </div>
          {right && <Skeleton w={28} h={9} />}
        </div>
      ))}
    </div>
  );
}
