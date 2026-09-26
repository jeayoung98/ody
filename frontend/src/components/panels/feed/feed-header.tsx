"use client";

import { useRef } from "react";
import { useDrill } from "@/hooks/use-drill";
import Avatar from "@/components/common/avatar";
import Button from "@/components/common/button";
import Note from "@/components/common/note";
import { useFollowMutation, useUnfollowMutation } from "@/hooks/mutations/use-follow-mutation";
import { useRideMutation } from "@/hooks/mutations/use-ride-mutation";
import { useSheetStop } from "@/hooks/use-sheet-stop";
import { useStartActivity } from "@/hooks/use-start-activity";
import { useFollowStore } from "@/stores/use-follow-store";
import type { UserProfile } from "@/types";

interface FeedHeaderProps {
  profile: UserProfile;
  isMe: boolean;
  /** 팔로워·팔로잉 숫자를 눌렀다 (S15P21A405-577). 목록을 어디에 그릴지는 패널이 정한다 */
  onOpenFollows: (type: "follower" | "following") => void;
}

/**
 * 숫자 하나. **누를 수 있는 것과 아닌 것이 섞여 있다** (S15P21A405-577) — 팔로워·팔로잉은
 * 목록으로 들어가고, 만남 횟수는 들어갈 곳이 없다. 눌리는 것만 손 모양이 된다.
 *
 * 글자 모양은 양쪽이 같다. 숫자 세 개가 한 줄에 나란히 서 있어서 하나만 링크처럼 꾸미면
 * 줄이 들쭉날쭉해진다 — 다른 것은 커서와 hover 로 말한다.
 */
function StatInline({ label, value, onClick }: { label: string; value: number | string; onClick?: () => void }) {
  const body = (
    <>
      {label} <b className="num text-md normal-case tracking-normal text-ink">{value}</b>
    </>
  );
  if (!onClick) return <span className="lbl">{body}</span>;
  return (
    <button type="button" onClick={onClick} className="lbl cursor-pointer transition-colors duration-fast hover:text-ink">
      {body}
    </button>
  );
}

/**
 * [상단] 닉네임 · 프로필 사진 · 재생중인 곡 · 온라인 여부 · 팔로워/팔로잉 · 가입일(N일째 탐험중)
 * 남일 때: 만남 횟수 · 따라가기
 */
export default function FeedHeader({ profile, isMe, onOpenFollows }: FeedHeaderProps) {
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const ride = useRideMutation();
  const follow = useFollowMutation();
  const unfollow = useUnfollowMutation();
  // 탭 화면에서는 지도로 돌아가서 연다 (S15P21A405-666)
  const drill = useDrill();
  const startActivity = useStartActivity();
  /** 폰 시트 2 단이 이 버튼 줄 아래에서 멈춘다 (S15P21A405-703) — 내 프로필엔 버튼이 없어 기본 높이다 */
  const actionsRef = useRef<HTMLDivElement>(null);
  useSheetStop(actionsRef);

  /** 지금 이 사람의 우주선에 **타고 있는가** (지금 이 순간의 일) */
  const isRiding = leaderEmail === profile.email;
  /** 이 사람을 **구독 중인가** (오래 남는 관계). 서버가 준 값이다 */
  const isFollowing = profile.isFollowing;
  /**
   * **내 페이지는 늘 접속 중이다** (S15P21A405-620). 서버의 `isOnline` 은 소켓 presence 유무라,
   * 소켓이 아직 안 붙었거나 끊긴 순간에 내 마이페이지가 "오프라인" 으로 뜬다 — 내가 지금 이
   * 화면을 보고 있다는 사실이 곧 접속 중이라는 뜻이므로 서버 값을 기다리지 않는다. 남은 서버 값 그대로.
   */
  const online = isMe || profile.isOnline;
  const canRide = !isMe && online && !isRiding;

  /**
   * 구독 — **실연동이다** (S15P21A405-489). 해제는 팔로우 중이 아니어도 200 이라 먼저 확인하지
   * 않는다. 응답의 `followeeFollowerCnt` 가 바뀐 뒤 값이지만, 같은 화면의 다른 값도 맞춰야 해서
   * 훅이 프로필 쿼리를 무효화한다.
   */
  const pending = follow.isPending || unfollow.isPending;
  const handleFollow = () => (isFollowing ? unfollow : follow).mutate(profile.email);

  /**
   * 탑승 — **실연동이다** (S15P21A405-530). 예전에는 이 화면 안에서만 도는 로컬 상태였다.
   * 거부 사유(`RIDE_FULL` · `RIDE_CAPTAIN_INACTIVE` …)는 훅이 토스트로 알린다.
   *
   * ACT-01: 다른 활동(여정·플리 재생, 다른 사람 탑승)이 진행 중이면 확인 후 멈추고 시작한다.
   */
  const handleRide = () =>
    startActivity("follow", profile.email, () =>
      // 지금 듣는 곡이 곧 그 사람이 선 자리다 — 넘기면 표식이 응답을 안 기다린다 (S15P21A405-642)
      ride.mutate({ email: profile.email, nickname: profile.nickname, imageUrl: profile.imageUrl, musicId: profile.nowPlaying?.id ?? null }),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Avatar src={profile.imageUrl} name={profile.nickname} size={56} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-semibold">{profile.nickname ?? profile.name ?? "익명"}</p>
          <p className="mt-[3px] text-[13.5px] text-ink-2">
            {online ? "접속 중" : "오프라인"} · {profile.daysSinceJoined}일째 탐험중
          </p>
          {profile.nowPlaying && (
            <button type="button" onClick={() => drill({ panel: "song", musicId: profile.nowPlaying!.id })} className="mt-0.5 block max-w-full truncate text-xs text-teal hover:underline">
              ♪ {profile.nowPlaying.title} — {profile.nowPlaying.artist ?? ""}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3.5">
        {/* 상시 접속 계정은 팔로워 수를 보정해서 보여 주므로 목록은 열지 않는다 — 열면 수와 인원이 어긋난다 (S15P21A405-683) */}
        <StatInline label="팔로워" value={profile.followerCount.toLocaleString()} onClick={profile.isBot ? undefined : () => onOpenFollows("follower")} />
        <StatInline label="팔로잉" value={profile.followingCount.toLocaleString()} onClick={() => onOpenFollows("following")} />
        {!isMe && <StatInline label="만남" value={`${profile.meetingCount ?? 0}회`} />}
      </div>

      {!isMe && (
        /* 폰에서는 둘을 나란히 둔다 (S15P21A405-703) — 세로로 쌓으면 2 단 시트에 둘 다 걸리지 않았다 */
        <div ref={actionsRef} className="flex flex-col gap-1.5 max-tablet:grid max-tablet:grid-cols-2 max-tablet:gap-2">
          {/* 구독과 탑승은 다른 일이다 — 구독은 오래 남는 관계, 탑승은 지금 이 순간 따라다니는 것 */}
          <Button variant={isFollowing ? "secondary" : "primary"} onClick={handleFollow} disabled={pending}>
            {isFollowing ? "팔로잉" : "팔로우"}
          </Button>
          <Button variant="secondary" onClick={handleRide} disabled={!canRide || ride.isPending}>
            {isRiding ? "🚀 탑승 중" : "🚀 따라가기"}
          </Button>
          {!online && (
            <div className="max-tablet:col-span-2">
              <Note>오프라인이라 따라갈 수 없습니다.</Note>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
