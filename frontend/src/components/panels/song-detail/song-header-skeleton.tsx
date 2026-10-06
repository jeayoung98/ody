import Skeleton from "@/components/common/skeleton";

interface SongHeaderSkeletonProps {
  /** 지도가 이미 아는 제목. 없으면 회색 막대로 자리만 잡는다 */
  title?: string | null;
  artist?: string | null;
}

/**
 * 곡 상세 제목 줄을 불러오는 동안의 자리 (S15P21A405-384 · 691).
 *
 * **커버는 자리를 안 잡는다.** 절차적 커버는 `musicId` 하나로 나오므로 이미 뒤에 깔려 있다
 * (`song-cover-backdrop`) — 그 위에 회색 네모를 또 얹으면 있는 그림을 가리는 셈이다.
 *
 * **제목·가수는 아는 곡이면 진짜 글자를 적는다** (S15P21A405-527). 지도에서 별을 눌러 들어온
 * 경우 상주 집합에 이미 그 값이 있다 — 아는 것을 회색 막대로 가려 둘 이유가 없다. 지도에 없는
 * 곡(고스트·검색 결과)이면 막대로 자리만 잡는다.
 *
 * 예전에는 패널 전체를 한 장의 스켈레톤으로 덮었는데, 행동 줄·소리 차트는 응답 없이도 그릴 수
 * 있어서 제목 줄만 남겼다 (S15P21A405-691). 칩(재생 수·길이·앨범)만 상세 응답에서 온다.
 */
export default function SongHeaderSkeleton({ title, artist }: SongHeaderSkeletonProps) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        {/*
          글자 크기·줄 높이·간격·그림자는 **`song-header` 와 똑같다** (S15P21A405-697). 예전에는 여기가 `text-xl`·`text-xs` 이고
          실제 제목 줄은 `text-3xl`·`text-sm` 이라, 응답이 오는 순간 제목이 커지며 아래가 밀렸다. 막대도 그 줄 높이(25px×1.2 · 14px×1.5)로 잡는다.
        */}
        <div className="mr-1 flex min-w-0 flex-1 flex-col gap-0.5">
          {title ? (
            <>
              <p className="truncate font-display text-3xl leading-[1.2] font-semibold text-ink drop-shadow-[0_2px_8px_rgba(4,6,13,.85)]">{title}</p>
              <p className="truncate text-sm text-ink-2 drop-shadow-[0_1px_6px_rgba(4,6,13,.9)]">{artist ?? "Unknown"}</p>
            </>
          ) : (
            <>
              <Skeleton w="62%" h={30} rounded="box" />
              <Skeleton w="38%" h={21} />
            </>
          )}
        </div>
        <Skeleton w={36} h={36} />
      </div>
      {/* 칩 줄 */}
      <div className="flex gap-[5px]">
        <Skeleton w={54} h={19} />
        <Skeleton w={42} h={19} />
        <Skeleton w={66} h={19} />
      </div>
    </>
  );
}
