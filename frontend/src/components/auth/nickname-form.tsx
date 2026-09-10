"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NICKNAME_MAX, nicknameError } from "@/lib/auth-rules";
import { ROUTES } from "@/constants";
import { useNicknameAvailableQuery } from "@/hooks/queries/use-nickname-available-query";
import { useSetNicknameMutation } from "@/hooks/mutations/use-set-nickname-mutation";
import type { ApiError } from "@/lib/api";
import AuthField from "./auth-field";

/**
 * 가입 직후 닉네임 설정 (AUTH-01). 구글로 가입해도 이 화면을 거친다.
 * 중복은 입력 중에 미리 확인해서, 제출하고 나서 되돌아오지 않게 한다.
 */
export default function NicknameForm() {
  const router = useRouter();
  const save = useSetNicknameMutation();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [touched, setTouched] = useState(false);

  // 한 글자마다 물어보지 않는다
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 350);
    return () => clearTimeout(t);
  }, [value]);

  const formatError = touched ? nicknameError(value) : null;
  const check = useNicknameAvailableQuery(debounced);
  const settled = !formatError && debounced === value.trim() && check.data?.nickname === debounced;
  const taken = settled && check.data?.available === false;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nicknameError(value) || taken) return;
    save.mutate(value, { onSuccess: () => router.replace(ROUTES.home) });
  };

  return (
    <form onSubmit={submit} noValidate>
      <AuthField
        label="닉네임"
        placeholder="지도에서 보일 이름"
        maxLength={NICKNAME_MAX}
        value={value}
        error={formatError ?? (taken ? "이미 누가 쓰고 있어요. 다른 닉네임을 골라주세요." : null)}
        hint={settled && check.data?.available ? "쓸 수 있는 닉네임이에요." : `2~${NICKNAME_MAX}자 · 다른 사람과 겹칠 수 없어요`}
        onChange={(e) => {
          setValue(e.target.value);
          setTouched(true);
        }}
      />

      {save.isError && <p className="mt-3 text-[11.5px] text-bad">{(save.error as ApiError).message}</p>}

      <button
        type="submit"
        disabled={save.isPending || !!nicknameError(value) || taken || check.isFetching}
        className="grad-bg mt-5 w-full rounded-pill py-3 text-[13.5px] font-semibold text-[#031018] shadow-[0_8px_28px_-12px_rgba(92,157,255,.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {save.isPending ? "저장 중…" : "이 닉네임으로 시작하기"}
      </button>
    </form>
  );
}
