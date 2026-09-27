import Skeleton from "@/components/common/skeleton";
import SkeletonRows from "@/components/common/skeleton-rows";

/**
 * 경로를 만드는 동안의 자리 (PATH-01/02, S15P21A405-503).
 *
 * 여기만 글자 한 줄을 남긴다. 다른 패널의 기다림은 화면을 연 결과라 저절로 끝나지만, 여정은
 * **사용자가 눌러서 시작한 긴 일**이라 "지금 뭘 하는 중인지" 를 말해 줘야 한다.
 */
export default function JourneySkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      {/* 출발 · 도착 (`journey-endpoints` 와 같은 상자) */}
      <div className="flex flex-col gap-2 rounded-box-sm bg-white/[.025] px-3 py-2.5">
        <Skeleton w="68%" h={12} />
        <Skeleton w="54%" h={12} />
      </div>
      <p className="lbl text-center">경로를 만드는 중</p>
      <div className="-mx-1.5">
        <SkeletonRows count={6} thumb="none" />
      </div>
    </div>
  );
}
