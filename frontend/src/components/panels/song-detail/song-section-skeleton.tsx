import Skeleton from "@/components/common/skeleton";

interface SongSectionSkeletonProps {
  /** 카드 줄까지 깐다 — 주변곡 칸. 없으면 제목과 줄글 몇 줄만 */
  cards?: boolean;
}

/**
 * 곡 상세 아래 칸 하나를 불러오는 동안의 자리 (S15P21A405-691).
 *
 * 실제 화면과 1:1로 맞추지 않는다 — 값이 채워질 때 미세하게 어긋나는 것이 오히려 눈에 띄고,
 * 여기서 할 일은 "이만큼 올 거예요" 뿐이다. 주변곡은 카드 줄이 높아서 카드 자리까지 잡아야
 * 값이 올 때 아래 소리 차트가 밀려 내려가지 않는다.
 */
export default function SongSectionSkeleton({ cards = false }: SongSectionSkeletonProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton w={120} h={13} />
      <Skeleton w="92%" h={10} />
      <Skeleton w="64%" h={10} />
      {cards && (
        <div className="mt-1 flex gap-2">
          <Skeleton w={112} h={112} rounded="box" />
          <Skeleton w={112} h={112} rounded="box" />
          <Skeleton w={112} h={112} rounded="box" />
        </div>
      )}
    </div>
  );
}
