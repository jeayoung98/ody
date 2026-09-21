import Divider from "@/components/common/divider";
import Skeleton from "@/components/common/skeleton";
import SkeletonRows from "@/components/common/skeleton-rows";

/**
 * 플레이리스트 상세를 불러오는 동안의 자리 (PATH-06, S15P21A405-503).
 * 제목 · 만든 이 줄 · 분위기 칩 · 버튼 한 쌍 · 곡 목록 — `playlist-header` + `playlist-track-list`.
 */
export default function PlaylistSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-212px)] flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <Skeleton w="58%" h={18} rounded="box" />
        <Skeleton w="44%" h={10} />
        <div className="flex gap-[5px]">
          <Skeleton w={48} h={19} />
          <Skeleton w={62} h={19} />
        </div>
        <Skeleton w="100%" h={36} rounded="box" />
      </div>
      <Divider />
      <div className="-mx-1.5">
        <SkeletonRows count={6} thumb="none" />
      </div>
    </div>
  );
}
