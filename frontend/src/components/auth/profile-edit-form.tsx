"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Avatar from "@/components/common/avatar";
import Loading from "@/components/common/loading";
import { ROUTES } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useUpdateProfileMutation, type ProfilePatch } from "@/hooks/mutations/use-update-profile-mutation";
import { useUpdateVisibilityMutation } from "@/hooks/mutations/use-update-visibility-mutation";
import type { ApiError } from "@/lib/api";
import type { User } from "@/types";
import AuthField from "./auth-field";
import NicknameCheckField from "./nickname-check-field";

/**
 * 프로필 수정 (USER-02, S15P21A405-470) — 닉네임 · 프로필 이미지 · 공개 설정.
 *
 * 내 정보가 올 때까지 기다렸다가 그리는 이유: 입력칸의 첫 값이 지금 값이어야 하는데,
 * `useState` 초기값은 첫 렌더 때 한 번만 읽힌다. 안쪽 컴포넌트를 `key` 로 다시 만들어
 * 값이 도착한 시점에 초기화한다.
 */
export default function ProfileEditForm() {
  const { data: me, isPending } = useMeQuery();
  if (isPending) return <Loading />;
  if (!me) return <p className="text-center text-[12px] text-bad">내 정보를 불러오지 못했어요.</p>;
  return <Fields key={me.email} me={me} />;
}

function Fields({ me }: { me: User }) {
  const router = useRouter();
  const save = useUpdateProfileMutation();
  const saveVisibility = useUpdateVisibilityMutation();

  const [nickname, setNickname] = useState(me.nickname ?? "");
  const [imageUrl, setImageUrl] = useState(me.imageUrl ?? "");
  const [isPublic, setIsPublic] = useState(me.isPublic);
  const [nicknameOk, setNicknameOk] = useState(false);

  const nicknameChanged = nickname.trim() !== (me.nickname ?? "").trim();
  const imageChanged = imageUrl.trim() !== (me.imageUrl ?? "").trim();
  const visibilityChanged = isPublic !== me.isPublic;
  const dirty = nicknameChanged || imageChanged || visibilityChanged;
  const pending = save.isPending || saveVisibility.isPending;
  const error = (save.error ?? saveVisibility.error) as ApiError | null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 아무것도 안 바꿨으면 그냥 돌아간다 — 빈 요청을 보내면 백엔드가 400 으로 답한다
    if (!dirty) return router.replace(ROUTES.home);
    if (nicknameChanged && !nicknameOk) return;

    const patch: ProfilePatch = {};
    if (nicknameChanged) patch.nickname = nickname.trim();
    if (imageChanged) patch.imageUrl = imageUrl.trim();

    try {
      // 둘은 백엔드 엔드포인트가 달라서 따로 보낸다. 앞이 실패하면 뒤는 보내지 않는다
      if (Object.keys(patch).length) await save.mutateAsync(patch);
      if (visibilityChanged) await saveVisibility.mutateAsync(isPublic);
      router.replace(ROUTES.home);
    } catch {
      // 오류 문구는 아래에서 보여준다
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Avatar src={imageUrl.trim() || null} name={nickname || me.name} size={64} />
      </div>

      <NicknameCheckField value={nickname} onChange={setNickname} onStatus={useCallback((v: boolean) => setNicknameOk(v), [])} current={me.nickname} />

      <AuthField
        label="프로필 사진 주소"
        placeholder="https://…"
        value={imageUrl}
        inputMode="url"
        onChange={(e) => setImageUrl(e.target.value)}
        hint="사진 파일 올리기는 아직 준비 중이에요 — 지금은 주소만 넣을 수 있어요. 비우면 지워집니다."
      />

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[13px] border border-line bg-white/[.03] px-3.5 py-3">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal" />
        <span className="min-w-0">
          <span className="block text-[12.5px] font-medium">공개 계정</span>
          <span className="mt-0.5 block text-[11px] leading-[1.5] text-ink-3">끄면 다른 사람이 내 프로필을 열거나 나를 따라올 수 없어요.</span>
        </span>
      </label>

      {error && <p className="text-[11.5px] text-bad">{error.message}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.replace(ROUTES.home)}
          className="flex-1 rounded-pill border border-line py-3 text-[13px] text-ink-2 transition-colors hover:border-line-2"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending || (nicknameChanged && !nicknameOk)}
          className="grad-bg flex-[1.4] rounded-pill py-3 text-[13.5px] font-semibold text-[#031018] shadow-[0_8px_28px_-12px_rgba(92,157,255,.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "저장 중…" : dirty ? "저장하기" : "그대로 두기"}
        </button>
      </div>
    </form>
  );
}
