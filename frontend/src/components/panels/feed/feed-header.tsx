"use client";

import Avatar from "@/components/common/avatar";
import Button from "@/components/common/button";
import Note from "@/components/common/note";
import { useStartFollowMutation } from "@/hooks/mutations/use-follow-mutation";
import { useStartActivity } from "@/hooks/use-start-activity";
import { useFollowStore } from "@/stores/use-follow-store";
import { usePanelStore } from "@/stores/use-panel-store";
import type { UserProfile } from "@/types";

interface FeedHeaderProps {
  profile: UserProfile;
  isMe: boolean;
}

function StatInline({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="lbl">
      {label} <b className="num text-sm normal-case tracking-normal text-ink">{value}</b>
    </span>
  );
}

/**
 * [상단] 닉네임 · 프로필 사진 · 재생중인 곡 · 온라인 여부 · 팔로워/팔로잉 · 가입일(N일째 탐험중)
 * 남일 때: 만남 횟수 · 따라가기
 */
export default function FeedHeader({ profile, isMe }: FeedHeaderProps) {
  const leaderEmail = useFollowStore((s) => s.leaderEmail);
  const startFollow = useFollowStore((s) => s.start);
  const followMutation = useStartFollowMutation();
  const openSong = usePanelStore((s) => s.openSong);
  const startActivity = useStartActivity();

  const isFollowingThis = leaderEmail === profile.email;
  const canFollow = !isMe && profile.isOnline && profile.isPublic && !isFollowingThis;

  // ACT-01: 다른 활동(여정·플리 재생, 다른 사람 따라가기)이 진행 중이면 확인 후 멈추고 시작한다
  const handleFollow = () => {
    startActivity("follow", profile.email, () => {
      followMutation.mutate(profile.email);
      startFollow(profile.email, profile.nickname);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Avatar src={profile.imageUrl} name={profile.nickname} size={56} online={profile.isOnline} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-semibold">{profile.nickname ?? profile.name ?? "익명"}</p>
          <p className="mt-[3px] text-[11.5px] text-ink-2">
            {profile.isOnline ? (profile.isPublic ? "공개 · 접속 중" : "비공개 · 접속 중") : "오프라인"} · {profile.daysSinceJoined}일째 탐험중
          </p>
          {profile.nowPlaying && (
            <button type="button" onClick={() => openSong(profile.nowPlaying!.id)} className="mt-0.5 block max-w-full truncate text-xs text-teal hover:underline">
              ♪ {profile.nowPlaying.title} — {profile.nowPlaying.artist ?? ""}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3.5">
        <StatInline label="팔로워" value={profile.followerCount.toLocaleString()} />
        <StatInline label="팔로잉" value={profile.followingCount.toLocaleString()} />
        {!isMe && <StatInline label="만남" value={`${profile.meetingCount ?? 0}회`} />}
      </div>

      {!isMe && (
        <div className="flex flex-col gap-1.5">
          <Button variant="primary" onClick={handleFollow} disabled={!canFollow || followMutation.isPending}>
            {isFollowingThis ? "🚀 탑승 중" : "🚀 따라가기"}
          </Button>
          {!profile.isOnline && <Note>오프라인이라 따라갈 수 없습니다.</Note>}
          {profile.isOnline && !profile.isPublic && (
            <Note>
              비공개 계정이라 따라가기를 시작할 수 없습니다. <span className="text-ink-4">SOCIAL-06</span>
            </Note>
          )}
        </div>
      )}
    </div>
  );
}
