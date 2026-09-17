import Divider from "@/components/common/divider";
import Skeleton from "@/components/common/skeleton";

/**
 * 곡 상세를 불러오는 동안의 자리 (S15P21A405-384).
 *
 * **커버는 자리를 안 잡는다.** 절차적 커버는 `musicId` 하나로 나오므로 이미 뒤에 깔려 있다
 * (`song-cover-backdrop`) — 그 위에 회색 네모를 또 얹으면 있는 그림을 가리는 셈이다.
 *
 * 나머지는 **줄글처럼 두루뭉술하게** 깐다. 제목·가수 자리에 굵기가 다른 줄 둘, 칩 줄, 버튼 줄,
 * 그리고 아래로 섹션 하나와 카드 세 장. 실제 화면과 1:1로 맞추지 않는다 — 값이 채워질 때
 * 미세하게 어긋나는 것이 오히려 눈에 띄고, 여기서 할 일은 "이만큼 올 거예요" 뿐이다.
 */
export default function SongDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      {/* 제목 · 가수 */}
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton w="62%" h={22} rounded="box" />
          <Skeleton w="38%" h={11} />
        </div>
        <Skeleton w={36} h={36} />
      </div>
      {/* 칩 줄 */}
      <div className="flex gap-[5px]">
        <Skeleton w={54} h={19} />
        <Skeleton w={42} h={19} />
        <Skeleton w={66} h={19} />
      </div>
      {/* 여정 버튼 한 쌍 */}
      <Skeleton w="100%" h={36} rounded="box" />
      <Divider />
      {/* 아래로 이어지는 칸들 — 제목 한 줄과 줄글 몇 줄 */}
      <div className="flex flex-col gap-2.5">
        <Skeleton w={96} h={13} />
        <Skeleton w="88%" h={10} />
        <Skeleton w="72%" h={10} />
        <Skeleton w="80%" h={10} />
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton w={120} h={13} />
        <div className="flex gap-2">
          <Skeleton w={112} h={112} rounded="box" />
          <Skeleton w={112} h={112} rounded="box" />
          <Skeleton w={112} h={112} rounded="box" />
        </div>
      </div>
    </div>
  );
}
