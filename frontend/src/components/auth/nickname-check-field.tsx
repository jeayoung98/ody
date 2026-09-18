"use client";

import { NICKNAME_MAX, nicknameError } from "@/lib/auth-rules";
import { useNicknameAvailableQuery } from "@/hooks/queries/use-nickname-available-query";
import { useEffect, useState } from "react";
import AuthField from "./auth-field";

/**
 * 닉네임 입력 + 중복 확인 (AUTH-01). 가입 화면과 구글 신규 사용자 화면이 같이 쓴다.
 * 중복은 입력 중에 미리 확인해서, 제출하고 나서 되돌아오지 않게 한다.
 */
export default function NicknameCheckField({
  value,
  onChange,
  onStatus,
  current,
}: {
  value: string;
  onChange: (v: string) => void;
  /** 지금 값이 제출 가능한지 (형식 통과 + 중복 아님 + 확인 끝남) */
  onStatus: (ok: boolean) => void;
  /**
   * 이미 내가 쓰고 있는 닉네임 (프로필 수정 화면). 이 값과 같으면 **중복 확인을 하지 않는다** —
   * 물어보면 내 닉네임이라 "이미 사용 중" 이 나와서, 이름을 그대로 두고 프사만 바꾸려 해도 막힌다.
   */
  current?: string | null;
}) {
  const [debounced, setDebounced] = useState("");
  const [touched, setTouched] = useState(false);

  // 한 글자마다 물어보지 않는다
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 350);
    return () => clearTimeout(t);
  }, [value]);

  const unchanged = !!current && value.trim() === current.trim();
  const formatError = touched ? nicknameError(value) : null;
  const check = useNicknameAvailableQuery(unchanged ? "" : debounced);
  const settled = !nicknameError(value) && debounced === value.trim() && check.isSuccess;
  const taken = !unchanged && settled && check.data?.available === false;
  const free = unchanged || (settled && check.data?.available === true);

  useEffect(() => onStatus(free), [free, onStatus]);

  return (
    <AuthField
      label="닉네임"
      placeholder="지도에서 보일 이름"
      maxLength={NICKNAME_MAX}
      value={value}
      error={formatError ?? (taken ? "이미 사용 중인 닉네임이에요." : null)}
      hint={unchanged ? "지금 쓰고 있는 닉네임이에요." : free ? "쓸 수 있는 닉네임이에요." : `2~${NICKNAME_MAX}자 · 다른 사람과 겹칠 수 없어요`}
      onChange={(e) => {
        onChange(e.target.value);
        setTouched(true);
      }}
    />
  );
}
