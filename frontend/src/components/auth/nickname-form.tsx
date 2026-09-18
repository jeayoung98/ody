"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ROUTES } from "@/constants";
import { nicknameError } from "@/lib/auth-rules";
import { useUpdateProfileMutation } from "@/hooks/mutations/use-update-profile-mutation";
import type { ApiError } from "@/lib/api";
import NicknameCheckField from "./nickname-check-field";

/**
 * 구글로 가입한 신규 사용자의 닉네임 설정 (AUTH-01).
 * 백엔드는 구글 신규 사용자의 nickname 을 **비워둔 채** 넣는다 (CustomOAuth2UserService) —
 * 이메일 가입은 가입 요청에서 닉네임을 함께 받으므로 이 화면을 거치지 않는다.
 */
export default function NicknameForm() {
  const router = useRouter();
  const save = useUpdateProfileMutation();
  const [value, setValue] = useState("");
  const [ok, setOk] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nicknameError(value)) return;
    save.mutate({ nickname: value }, { onSuccess: () => router.replace(ROUTES.home) });
  };

  return (
    <form onSubmit={submit} noValidate>
      <NicknameCheckField value={value} onChange={setValue} onStatus={useCallback((v: boolean) => setOk(v), [])} />

      {save.isError && <p className="mt-3 text-[11.5px] text-bad">{(save.error as ApiError).message}</p>}

      <button
        type="submit"
        disabled={save.isPending || !ok}
        className="grad-bg mt-5 w-full rounded-pill py-3 text-[13.5px] font-semibold text-[#031018] shadow-[0_8px_28px_-12px_rgba(92,157,255,.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {save.isPending ? "저장 중…" : "이 닉네임으로 시작하기"}
      </button>
    </form>
  );
}
