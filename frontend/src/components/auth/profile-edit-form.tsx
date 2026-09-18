"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/common/avatar";
import Loading from "@/components/common/loading";
import { ROUTES } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useUpdateNicknameMutation } from "@/hooks/mutations/use-update-nickname-mutation";
import { useUpdateProfileImageMutation } from "@/hooks/mutations/use-update-profile-image-mutation";
import { useUpdateVisibilityMutation } from "@/hooks/mutations/use-update-visibility-mutation";
import type { ApiError } from "@/lib/api";
import type { User } from "@/types";
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
  const saveNickname = useUpdateNicknameMutation();
  const saveImage = useUpdateProfileImageMutation();
  const saveVisibility = useUpdateVisibilityMutation();

  const [nickname, setNickname] = useState(me.nickname ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(me.isPublic);
  const [nicknameOk, setNicknameOk] = useState(false);
  const pickFile = useRef<HTMLInputElement>(null);

  // 고른 사진을 저장 전에 보여 준다. 만든 주소는 반드시 거둔다 — 안 거두면 다른 사진을
  // 고를 때마다 앞의 것이 메모리에 남는다
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const nicknameChanged = nickname.trim() !== (me.nickname ?? "").trim();
  const visibilityChanged = isPublic !== me.isPublic;
  const dirty = nicknameChanged || file !== null || visibilityChanged;
  const pending = saveNickname.isPending || saveImage.isPending || saveVisibility.isPending;
  const error = (saveNickname.error ?? saveImage.error ?? saveVisibility.error) as ApiError | null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 아무것도 안 바꿨으면 그냥 돌아간다 — 빈 요청을 보내면 백엔드가 400 으로 답한다
    if (!dirty) return router.replace(ROUTES.home);
    if (nicknameChanged && !nicknameOk) return;

    try {
      // 셋 다 백엔드 엔드포인트가 다르다. 앞이 실패하면 뒤는 보내지 않는다 —
      // 닉네임이 중복이라 막혔는데 사진만 바뀌어 있으면 무엇이 저장됐는지 알 수 없다
      if (nicknameChanged) await saveNickname.mutateAsync(nickname.trim());
      if (file) await saveImage.mutateAsync(file);
      if (visibilityChanged) await saveVisibility.mutateAsync(isPublic);
      router.replace(ROUTES.home);
    } catch {
      // 오류 문구는 아래에서 보여준다
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <Avatar src={preview ?? me.imageUrl} name={nickname || me.name} size={64} />
        <button type="button" onClick={() => pickFile.current?.click()} className="text-[11.5px] text-ink-2 underline underline-offset-2 hover:text-ink-1">
          사진 바꾸기
        </button>
        <input
          ref={pickFile}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-[11px] text-ink-3">{file ? `${file.name} — 저장하면 올라가요` : "5MB 까지, 이미지 파일만 올릴 수 있어요"}</p>
      </div>

      <NicknameCheckField value={nickname} onChange={setNickname} onStatus={useCallback((v: boolean) => setNicknameOk(v), [])} current={me.nickname} />

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
