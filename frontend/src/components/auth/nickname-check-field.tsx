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
}: {
  value: string;
  onChange: (v: string) => void;
  /** 지금 값이 제출 가능한지 (형식 통과 + 중복 아님 + 확인 끝남) */
  onStatus: (ok: boolean) => void;
}) {
  const [debounced, setDebounced] = useState("");
  const [touched, setTouched] = useState(false);

  // 한 글자마다 물어보지 않는다
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 350);
    return () => clearTimeout(t);
  }, [value]);

  const formatError = touched ? nicknameError(value) : null;
  const check = useNicknameAvailableQuery(debounced);
  const settled = !nicknameError(value) && debounced === value.trim() && check.isSuccess;
  const taken = settled && check.data?.available === false;
  const free = settled && check.data?.available === true;

  useEffect(() => onStatus(free), [free, onStatus]);

  return (
    <AuthField
      label="닉네임"
      placeholder="지도에서 보일 이름"
      maxLength={NICKNAME_MAX}
      value={value}
      error={formatError ?? (taken ? "이미 사용 중인 닉네임이에요." : null)}
      hint={free ? "쓸 수 있는 닉네임이에요." : `2~${NICKNAME_MAX}자 · 다른 사람과 겹칠 수 없어요`}
      onChange={(e) => {
        onChange(e.target.value);
        setTouched(true);
      }}
    />
  );
}
