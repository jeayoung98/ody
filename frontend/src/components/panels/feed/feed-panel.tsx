"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import IconButton from "@/components/common/icon-button";
import { BackIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useUserProfileQuery } from "@/hooks/queries/use-user-profile-query";
import { isBot } from "@/lib/bots/roster";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelCloseButton from "../panel-close-button";
import FeedDashboard from "./feed-dashboard";
import FeedFollowList from "./feed-follow-list";
import FeedHeader from "./feed-header";
import FeedMenu from "./feed-menu";
import FeedPlaylists from "./feed-playlists";
import FeedSkeleton from "./feed-skeleton";

type FollowType = "follower" | "following";

const FOLLOW_TITLE: Record<FollowType, string> = { follower: "팔로워", following: "팔로잉" };

interface FeedPanelProps {
  /**
   * **이 자리는 언제나 내 페이지다** (S15P21A405-577). `/me` 탭 화면이 켠다.
   *
   * 끄면 스토어의 `profileEmail` 을 따른다 — 지도에서 사람을 누르거나 랭킹에서 골라 여는
   * 우측 패널이 그쪽이다.
   *
   * 나눠야 했던 이유: 하단 탭의 `마이페이지` 는 `/me` 로 **주소만 옮긴다.** 그런데 화면은
   * 스토어의 `profileEmail` 을 보고 있어서, 직전에 남의 프로필을 열어 본 적이 있으면
   * 마이페이지를 눌러도 **그 사람 피드가 그대로 떴다.** 탭에서 스토어를 지우는 방법도 있지만,
   * 그러면 뒤에 깔린 시트가 같은 값을 보고 있다가 같이 바뀐다 — 주소가 뜻을 가지게 두는 편이 낫다.
   */
  self?: boolean;
}

/** 피드 = 마이페이지(내 것) / 상대 프로필(남의 것). 레이아웃 동일 (USER-02, USER-04) */
export default function FeedPanel({ self = false }: FeedPanelProps) {
  const storeEmail = usePanelStore((s) => s.profileEmail);
  const openFeed = usePanelStore((s) => s.openFeed);
  const router = useRouter();
  const profileEmail = self ? null : storeEmail;
  const { data: me } = useMeQuery();
  const targetEmail = profileEmail ?? me?.email ?? null;
  const isMe = !profileEmail || profileEmail === me?.email;
  const { data, isPending, isError } = useUserProfileQuery(targetEmail);

  /**
   * 팔로워·팔로잉 목록을 보는 중인가. null 이면 프로필 본문 (S15P21A405-577).
   *
   * **누구의 목록인지 같이 들고 있는다.** 그래야 보는 사람이 바뀔 때(목록에서 남의 프로필로
   * 갈아탈 때) 목록이 **저절로** 접힌다 — 따로 지우는 `useEffect` 를 두면 그게 도는 사이
   * 한 프레임 동안 바뀐 사람 이름 밑에 이전 사람의 목록이 그대로 선다.
   */
  const [opened, setOpened] = useState<{ email: string; type: FollowType } | null>(null);
  const follows = opened && opened.email === targetEmail ? opened.type : null;
  const openFollows = (type: FollowType) => {
    if (targetEmail) setOpened({ email: targetEmail, type });
  };

  /**
   * 목록에서 한 사람을 골랐다.
   *
   * **`/me` 에서는 지도로 돌아간다** (S15P21A405-577). 남의 프로필은 지도 위 패널로 뜨는데
   * (`right-panel`, z-20) `/me` 는 그 위를 덮는 화면이라(z-22) 여기서 패널만 열면 **뒤에 가려
   * 아무 일도 안 일어난 것처럼 보인다.** 우측 패널에서 골랐을 때는 그 자리에서 갈아 끼운다.
   */
  const selectUser = (email: string) => {
    openFeed(email);
    if (self) router.push(ROUTES.home);
  };

  return (
    <Box
      title={follows ? FOLLOW_TITLE[follows] : isMe ? "마이페이지" : "프로필"}
      lead={
        follows && (
          <IconButton label="프로필로 돌아가기" onClick={() => setOpened(null)}>
            <BackIcon />
          </IconButton>
        )
      }
      /* 수정·로그아웃은 내 페이지에서만 (S15P21A405-524). 남의 프로필에 로그아웃이 보이면
         그 사람을 로그아웃시키는 것처럼 읽힌다. 목록을 보는 동안에도 감춘다 — 그 화면의
         메뉴가 아니다 */
      actions={
        <>
          {isMe && !follows && <FeedMenu />}
          <PanelCloseButton />
        </>
      }
    >
      {follows && targetEmail ? (
        /* 줄 간격을 랭킹 목록과 맞춘다 (`chart-panel`) — Box 본문의 gap-3.5 는 목록에는 너무 넓다 */
        <div className="-mx-1.5 flex flex-col gap-0.5">
          <FeedFollowList email={targetEmail} type={follows} isMe={isMe} onSelect={selectUser} />
        </div>
      ) : (
        <>
          {isPending && <FeedSkeleton />}
          {isError && <ErrorMessage />}
          {data && (
            <>
              <FeedHeader profile={data} isMe={isMe} onOpenFollows={isBot(targetEmail) ? undefined : openFollows} />
              <Divider />
              <FeedDashboard dashboard={data.dashboard} />
              {isMe && (
                <>
                  <Divider />
                  <FeedPlaylists />
                </>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}
