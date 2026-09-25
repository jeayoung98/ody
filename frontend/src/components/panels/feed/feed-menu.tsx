"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { useLogoutMutation } from "@/hooks/mutations/use-logout-mutation";

/**
 * 마이페이지 우측 상단 옵션 메뉴 (S15P21A405-524).
 *
 * 프로필 수정과 로그아웃은 **자주 쓰지 않는데 자리를 크게 먹던** 것들이다. 예전에는 패널
 * 맨 아래에 버튼 두 개로 깔려 있어서, 플리 목록을 끝까지 내려야 나왔고 목록이 길어질수록
 * 멀어졌다. 헤더의 점점점 뒤로 넣으면 늘 같은 자리에 있다.
 *
 * **내 페이지에서만 그린다.** 남의 프로필에서 "로그아웃" 이 보이면 그 사람을 로그아웃시키는
 * 것처럼 읽힌다 — 부르는 쪽(`feed-panel`)이 `isMe` 로 가른다.
 */
export default function FeedMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const logout = useLogoutMutation();

  /** 바깥을 누르거나 Esc 로 닫는다 — 열어 둔 채 다른 곳을 만지면 메뉴가 길을 막는다 */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // capture 로 듣는다 — 안쪽 버튼이 이벤트를 멈춰도 바깥 클릭 판정은 살아 있어야 한다
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "w-full px-3.5 py-2.5 text-left text-[14.5px] text-ink-2 transition-colors hover:bg-white/[.055] hover:text-ink";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="더 보기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-[26px] w-[26px] place-items-center rounded-pill transition-colors ${
          open ? "bg-white/[.08] text-ink" : "text-ink-3 hover:bg-white/[.055] hover:text-ink"
        }`}
      >
        <MoreIcon />
      </button>
      {open && (
        // 버튼 바로 밑, 오른쪽 끝을 맞춘다 — 왼쪽으로 펼쳐야 패널 밖으로 안 나간다
        <div
          role="menu"
          className="glass-liquid animate-rpop absolute top-full right-0 z-30 mt-1.5 w-[132px] overflow-hidden rounded-box-sm py-1 shadow-[0_18px_44px_-16px_#000]"
        >
          <button type="button" role="menuitem" className={item} onClick={() => router.push(ROUTES.profile)}>
            내 정보 수정
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={logout.isPending}
            className={`${item} text-bad hover:text-bad disabled:opacity-50`}
            // 요청이 실패해도 로컬 토큰은 지우고 로그인으로 보낸다 (`use-logout-mutation`)
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace(ROUTES.login) })}
          >
            {logout.isPending ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}
