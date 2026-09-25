"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Box from "@/components/common/box";
import Divider from "@/components/common/divider";
import ErrorMessage from "@/components/common/error-message";
import IconButton from "@/components/common/icon-button";
import UnderlineTabs from "@/components/common/underline-tabs";
import { BackIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useUserProfileQuery } from "@/hooks/queries/use-user-profile-query";
import { usePanelStore, type FollowType } from "@/stores/use-panel-store";
import PanelBackButton from "../panel-back-button";
import PanelCloseButton from "../panel-close-button";
import FeedDashboard from "./feed-dashboard";
import FeedFollowList from "./feed-follow-list";
import FeedHeader from "./feed-header";
import FeedMenu from "./feed-menu";
import FeedPlaylists from "./feed-playlists";
import FeedSkeleton from "./feed-skeleton";
import FeedTasteReport from "./feed-taste-report";

const FOLLOW_TITLE: Record<FollowType, string> = { follower: "팔로워", following: "팔로잉" };

/**
 * 본문 탭 (S15P21A405-662). 내 페이지는 셋, 남의 프로필은 취향 없이 둘 — 취향은 토큰 주체 것만 물을 수 있다 (630).
 * 한 줄로 이어 붙이던 것을 나눴다: 취향 리포트가 길어지면서 플리 목록이 화면 아래로 밀렸다.
 * 순서는 플리가 먼저다 — 자주 여는 것이 앞이고 취향은 가끔 본다. 모양은 곡 상세가 쓰던 밑줄 탭(`UnderlineTabs`, 435).
 */
type FeedTab = "taste" | "made" | "liked";
const MY_TABS = [
  { key: "made", label: "내 플리" },
  { key: "liked", label: "좋아요한 플리" },
  { key: "taste", label: "내 음악 취향" },
] as const satisfies ReadonlyArray<{ key: FeedTab; label: string }>;
const OTHER_TABS = [
  { key: "made", label: "플레이리스트" },
  { key: "liked", label: "좋아요한 플리" },
] as const satisfies ReadonlyArray<{ key: FeedTab; label: string }>;

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
  const drill = usePanelStore((s) => s.drill);
  const router = useRouter();
  const profileEmail = self ? null : storeEmail;
  const { data: me } = useMeQuery();
  const targetEmail = profileEmail ?? me?.email ?? null;
  const isMe = !profileEmail || profileEmail === me?.email;
  const { data, isPending, isError } = useUserProfileQuery(targetEmail);
  /** 기본은 플리. 사람이 바뀌면(나 → 남) 취향 탭이 없을 수 있어 아래에서 한 번 더 고른다 */
  const [tabChoice, setTabChoice] = useState<FeedTab | null>(null);
  const tabs = isMe ? MY_TABS : OTHER_TABS;
  const tab: FeedTab = tabChoice && tabs.some((t) => t.key === tabChoice) ? tabChoice : "made";

  /**
   * 팔로워·팔로잉 목록을 보는 중인가. null 이면 프로필 본문 (S15P21A405-577).
   *
   * **스토어에 있다** (S15P21A405-659) — 목록에서 사람을 골라 들어갔다가 돌아오면 그 목록까지 되살려야 해서다.
   * 사람이 바뀌면 `open`/`drill` 이 `feedFollows` 를 비우므로 이전 사람의 목록이 남지 않는다.
   * `/me` 탭 화면은 시트와 스토어를 같이 쓰므로, 시트에서 남의 목록을 보던 상태가 `/me` 에 비치지 않게 내 것일 때만 읽는다.
   */
  const storeFollows = usePanelStore((s) => s.feedFollows);
  const openFollows = usePanelStore((s) => s.openFollows);
  const closeFollows = usePanelStore((s) => s.closeFollows);
  const follows: FollowType | null = self && storeEmail != null ? null : storeFollows;

  /**
   * 목록에서 한 사람을 골랐다 — **타고 들어간다.** 지금 프로필(목록까지)이 돌아갈 자리로 쌓인다.
   *
   * **`/me` 에서는 지도로 돌아간다** (S15P21A405-577). 남의 프로필은 지도 위 패널로 뜨는데
   * (`right-panel`, z-20) `/me` 는 그 위를 덮는 화면이라(z-22) 여기서 패널만 열면 **뒤에 가려
   * 아무 일도 안 일어난 것처럼 보인다.**
   */
  const selectUser = (email: string) => {
    if (self) {
      // 탭 화면이라 시트가 없다 — 내 페이지(목록까지)를 돌아갈 자리로 직접 세운다
      usePanelStore.getState().openFeed(email);
      usePanelStore.setState({ history: [{ panel: "feed", profileEmail: null, follows }] }, false, "drill/fromMe");
      router.push(ROUTES.home);
      return;
    }
    drill({ panel: "feed", profileEmail: email });
  };

  return (
    <Box
      title={follows ? FOLLOW_TITLE[follows] : isMe ? "마이페이지" : "프로필"}
      lead={
        follows ? (
          <IconButton label="프로필로 돌아가기" onClick={closeFollows}>
            <BackIcon />
          </IconButton>
        ) : (
          !self && <PanelBackButton />
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
              <FeedHeader profile={data} isMe={isMe} onOpenFollows={(type) => (self ? usePanelStore.setState({ feedFollows: type }, false, "openFollows/me") : openFollows(type))} />
              <Divider />
              <FeedDashboard dashboard={data.dashboard} />
              <Divider />
              <UnderlineTabs items={tabs} value={tab} onChange={setTabChoice} />
              {/* **취향은 내 페이지에만** (S15P21A405-630). 백엔드가 토큰으로 사람을 정해서 남의 취향은 물어볼 수가 없다 —
                  USER-04 의 "레이아웃 동일" 을 어기는 게 아니라 API 가 낼 수 없는 화면이다 */}
              {tab === "taste" && isMe && me && <FeedTasteReport />}
              {/* **남의 피드에도 뜬다** (S15P21A405-587). 남의 것은 읽기 전용이라 만들기·삭제가 빠진다 (`feed-playlists`) */}
              {tab === "made" && <FeedPlaylists email={targetEmail} isMe={isMe} kind="made" />}
              {tab === "liked" && <FeedPlaylists email={targetEmail} isMe={isMe} kind="liked" />}
            </>
          )}
        </>
      )}
    </Box>
  );
}
