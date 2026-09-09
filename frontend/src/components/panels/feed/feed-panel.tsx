"use client";

import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import Loading from "@/components/common/loading";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useUserProfileQuery } from "@/hooks/queries/use-user-profile-query";
import { usePanelStore } from "@/stores/use-panel-store";
import PanelCloseButton from "../panel-close-button";
import FeedDashboard from "./feed-dashboard";
import FeedHeader from "./feed-header";
import FeedLikedPlaylists from "./feed-liked-playlists";
import FeedMyPlaylists from "./feed-my-playlists";

/** 피드 = 마이페이지(내 것) / 상대 프로필(남의 것). 레이아웃 동일 (USER-02, USER-04) */
export default function FeedPanel() {
  const profileEmail = usePanelStore((s) => s.profileEmail);
  const { data: me } = useMeQuery();
  const targetEmail = profileEmail ?? me?.email ?? null;
  const isMe = !profileEmail || profileEmail === me?.email;
  const { data, isPending, isError } = useUserProfileQuery(targetEmail);

  return (
    <Box title={isMe ? "마이페이지" : "프로필"} code={isMe ? "USER-02" : "USER-04"} actions={<PanelCloseButton />}>
      {isPending && <Loading />}
      {isError && <ErrorMessage />}
      {data && (
        <>
          <FeedHeader profile={data} isMe={isMe} />
          <Divider />
          <FeedDashboard dashboard={data.dashboard} />
          {isMe && (
            <>
              <Divider />
              <FeedMyPlaylists />
              <FeedLikedPlaylists />
            </>
          )}
        </>
      )}
    </Box>
  );
}
