"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Box from "@/components/common/box";
import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import ProfileEditForm from "./profile-edit-form";

/**
 * 내 정보 수정 팝업 (S15P21A405-672).
 *
 * 예전에는 마이페이지 메뉴가 `/profile` 로 **페이지를 갈아 끼웠다.** 그 경로는 `APP_ROUTES` 에
 * 없어서 `app-shell` 이 들고 있던 지도와 플레이어가 통째로 내려갔고, **듣고 있던 곡이 끊겼다.**
 * 닉네임 한 줄 고치자고 재생이 끊기는 건 대가가 너무 크다. 화면 위에 띄우면 아래는 그대로 산다.
 *
 * `/profile` 경로는 그대로 뒀다 — 북마크와 뒤로가기가 안 깨지게. 거기로 직접 들어오면
 * 예전처럼 페이지가 뜨고, 그쪽은 `onDone` 없이 쓰므로 저장 후 지도로 돌아간다.
 *
 * **`document.body` 로 빼서 그린다.** 우측 패널 안에 두면 `fixed inset-0` 이 화면이 아니라
 * 패널 안에 갇힌다 — 조상에 `transform`·`filter` 가 걸려 있으면 그게 고정 위치의 기준이 된다
 * (곡 신고 팝업이 같은 이유로 여기 있다).
 */
export default function ProfileEditDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-6 backdrop-blur-sm" onClick={onClose}>
      {/* 상자 안을 눌러도 닫히지 않게 — 바깥을 눌렀을 때만 닫는다 */}
      <div
        className="animate-tin w-full max-w-[380px]"
        role="dialog"
        aria-modal="true"
        aria-label="내 정보 수정"
        onClick={(e) => e.stopPropagation()}
      >
        <Box
          title="내 정보 수정"
          actions={
            <IconButton label="닫기" onClick={onClose} className="text-ink-2!">
              <CloseIcon />
            </IconButton>
          }
        >
          <p className="text-[14px] text-ink-2">지도와 프로필에 보이는 모습이에요.</p>
          <ProfileEditForm onDone={onClose} />
        </Box>
      </div>
    </div>,
    document.body,
  );
}
