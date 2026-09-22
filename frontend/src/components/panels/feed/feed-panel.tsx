"use client";

import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useUserProfileQuery } from "@/hooks/queries/use-user-profile-query";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelCloseButton from "../panel-close-button";
import FeedDashboard from "./feed-dashboard";
import FeedHeader from "./feed-header";
import FeedMenu from "./feed-menu";
import FeedPlaylists from "./feed-playlists";
import FeedSkeleton from "./feed-skeleton";

/** 피드 = 마이페이지(내 것) / 상대 프로필(남의 것). 레이아웃 동일 (USER-02, USER-04) */
export default function FeedPanel() {
  const profileEmail = usePanelStore((s) => s.profileEmail);
  const { data: me } = useMeQuery();
  const targetEmail = profileEmail ?? me?.email ?? null;
  const isMe = !profileEmail || profileEmail === me?.email;
  const { data, isPending, isError } = useUserProfileQuery(targetEmail);

  return (
    <Box
      title={isMe ? "마이페이지" : "프로필"}
      /* 수정·로그아웃은 내 페이지에서만 (S15P21A405-524). 남의 프로필에 로그아웃이 보이면
         그 사람을 로그아웃시키는 것처럼 읽힌다 */
      actions={
        <>
          {isMe && <FeedMenu />}
          <PanelCloseButton />
        </>
      }
    >
      {isPending && <FeedSkeleton />}
      {isError && <ErrorMessage />}
      {data && (
        <>
          <FeedHeader profile={data} isMe={isMe} />
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
    </Box>
  );
}
