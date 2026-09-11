"use client";

import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants";
import { useLogoutMutation } from "@/hooks/mutations/use-logout-mutation";

/** 마이페이지 로그아웃 (AUTH-03). 요청이 실패해도 로컬 토큰은 지우고 로그인으로 보낸다 */
export default function LogoutButton() {
  const router = useRouter();
  const logout = useLogoutMutation();

  return (
    <button
      type="button"
      disabled={logout.isPending}
      onClick={() => logout.mutate(undefined, { onSettled: () => router.replace(ROUTES.login) })}
      className="w-full rounded-[10px] border border-line px-3 py-2.5 text-[12px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink disabled:opacity-50"
    >
      {logout.isPending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
