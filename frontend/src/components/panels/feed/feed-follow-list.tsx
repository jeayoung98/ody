"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import EmptyState from "@/components/common/empty-state";
import ErrorMessage from "@/components/common/error-message";
import SkeletonRows from "@/components/common/skeleton-rows";
import UserRow from "@/components/common/user-row";
import { useFollowListQuery } from "@/hooks/queries/use-follow-list-query";

type FollowType = "follower" | "following";

interface FeedFollowListProps {
  /** 목록 주인 */
  email: string;
  type: FollowType;
  /** 목록 주인이 나인가 — 빈 목록 문구와 "팔로잉" 표시가 갈린다 */
  isMe: boolean;
  /** 한 사람을 골랐다. 그 사람 프로필로 **가는 길**은 부르는 쪽이 정한다 (폰·데스크톱이 다르다) */
  onSelect: (email: string) => void;
}

/** 아무도 없을 때. 남의 목록을 볼 때는 주어가 달라진다 */
const EMPTY: Record<FollowType, { me: string; other: string }> = {
  follower: { me: "아직 나를 팔로우한 사람이 없어요.", other: "아직 이 사람을 팔로우한 사람이 없어요." },
  following: { me: "아직 팔로우한 사람이 없어요.", other: "아직 아무도 팔로우하지 않았어요." },
};

/**
 * 팔로워·팔로잉 목록 (USER-02, S15P21A405-577).
 *
 * BFF 라우트도 훅도 S15P21A405-489 에서 이미 만들어 뒀는데 **화면이 붙은 적이 없다** —
 * 피드 상단의 숫자는 그냥 글자라 눌러도 아무 일이 없었다. 여기가 그 숫자를 누른 자리다.
 *
 * **같은 패널 안에서 갈아 끼운다.** 새 경로도 새 패널 종류도 만들지 않는다 — 피드는
 * 우측 패널(데스크톱)과 `/me` 화면(폰)이 컴포넌트 하나를 같이 쓰고 있어서, 어느 한쪽에
 * 새 자리를 만들면 나머지 한쪽에는 안 생긴다.
 */
export default function FeedFollowList({ email, type, isMe, onSelect }: FeedFollowListProps) {
  /**
   * 몇 쪽까지 불러왔나. 훅이 **한 쪽(20명)씩** 주고 쿼리 키에 쪽 번호가 들어가므로,
   * `page` 하나를 올리는 식으로 만들면 앞 쪽이 화면에서 사라진다. 그래서 쪽마다 하나씩 쌓는다.
   */
  const [pages, setPages] = useState(1);

  return (
    <>
      {Array.from({ length: pages }, (_, i) => (
        <FollowPage
          key={i}
          email={email}
          type={type}
          page={i}
          isMe={isMe}
          first={i === 0}
          last={i === pages - 1}
          onMore={() => setPages((n) => n + 1)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

interface FollowPageProps extends FeedFollowListProps {
  page: number;
  /** 첫 쪽만 "아무도 없어요" 를 말한다 — 둘째 쪽이 비는 건 그냥 끝났다는 뜻이다 */
  first: boolean;
  /** 마지막으로 불러온 쪽만 "더 보기" 를 단다 */
  last: boolean;
  onMore: () => void;
}

function FollowPage({ email, type, page, isMe, first, last, onMore, onSelect }: FollowPageProps) {
  const { data, isPending, isError } = useFollowListQuery(email, type, page);

  if (isPending) return <SkeletonRows count={first ? 5 : 2} thumb="circle" sub={false} right={false} />;
  if (isError) return <ErrorMessage />;

  const people = data?.content ?? [];
  if (first && people.length === 0) return <EmptyState message={EMPTY[type][isMe ? "me" : "other"]} />;

  /**
   * **"내가" 이 사람을 구독 중인가.** `isFollowing` 은 목록 주인이 아니라 토큰 주체 기준이라
   * (A-39) 남의 목록을 볼 때도 내 기준으로 온다 — 그래서 맞팔 여부로 읽힌다.
   *
   * **내 팔로잉 목록에서만 안 붙인다.** 거기 있는 사람은 전부 참이라 아무것도 안 알려 준다.
   */
  const showFollowing = !(isMe && type === "following");

  return (
    <>
      {people.map((p) => (
        <UserRow
          key={p.email}
          nickname={p.nickname ?? p.name}
          imageUrl={p.imageUrl}
          online={p.isOnline}
          right={showFollowing && p.isFollowing ? "팔로잉" : undefined}
          onClick={() => onSelect(p.email)}
        />
      ))}
      {last && data?.hasNext && (
        <Button size="sm" onClick={onMore} className="mt-1.5 self-center">
          더 보기
        </Button>
      )}
    </>
  );
}
