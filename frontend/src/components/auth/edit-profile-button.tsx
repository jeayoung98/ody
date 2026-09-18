"use client";

import Link from "next/link";
import { ROUTES } from "@/constants";

/** 마이페이지에서 프로필 수정 화면으로 가는 입구 (USER-02, S15P21A405-470) */
export default function EditProfileButton() {
  return (
    <Link
      href={ROUTES.profile}
      className="block w-full rounded-[13px] border border-line px-3 py-2.5 text-center text-[12px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
    >
      프로필 수정
    </Link>
  );
}
