import Divider from "@/components/common/divider";
import Skeleton from "@/components/common/skeleton";
import SkeletonRows from "@/components/common/skeleton-rows";

/**
 * 마이페이지 · 프로필을 불러오는 동안의 자리 (USER-02/04, S15P21A405-503).
 * 곡 상세(`song-detail-skeleton`)와 같은 말투다 — 사진 자리, 이름 두 줄, 숫자 셋, 그리고
 * 대시보드와 플리 목록.
 *
 * 높이를 패널 최대치에 맞춰 깔아 둔다. 짧게 깔면 값이 올 때 패널이 훌쩍 늘어나 화면이 한 번
 * 튄다 — 자리를 잡아 두는 것이 이 화면의 일이다.
 */
export default function FeedSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-212px)] flex-col gap-3.5">
      {/* 사진 · 닉네임 · 상태 한 줄 */}
      <div className="flex items-center gap-2.5">
        <Skeleton w={56} h={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton w="52%" h={20} rounded="box" />
          <Skeleton w="76%" h={10} />
        </div>
      </div>
      {/* 팔로워 · 팔로잉 · 만남 */}
      <div className="flex gap-3.5">
        <Skeleton w={62} h={13} />
        <Skeleton w={62} h={13} />
        <Skeleton w={50} h={13} />
      </div>
      <Divider />
      {/* 대시보드 — 라벨:값 두 줄 */}
      <div className="flex flex-col gap-2">
        <Skeleton w={64} h={9} />
        <div className="flex flex-col gap-[9px]">
          <div className="flex justify-between gap-3">
            <Skeleton w={96} h={10} />
            <Skeleton w={44} h={10} />
          </div>
          <div className="flex justify-between gap-3">
            <Skeleton w={118} h={10} />
            <Skeleton w={38} h={10} />
          </div>
        </div>
      </div>
      {/* 선호 분위기 — 라벨 / 막대 / 값 */}
      <div className="flex flex-col gap-2">
        <Skeleton w={72} h={9} />
        <div className="flex flex-col gap-[7px]">
          {["58%", "44%", "66%"].map((w) => (
            <div key={w} className="grid grid-cols-[1fr_76px_34px] items-center gap-[9px]">
              <Skeleton w={w} h={10} />
              <Skeleton w="100%" h={4} />
              <Skeleton w={24} h={9} />
            </div>
          ))}
        </div>
      </div>
      <Divider />
      {/* 플리 목록 */}
      <div className="-mx-1.5 flex flex-col gap-2">
        <Skeleton w={88} h={9} className="mx-1.5" />
        <SkeletonRows count={3} />
      </div>
    </div>
  );
}
