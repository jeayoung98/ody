"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import Box from "./box";
import IconButton from "./icon-button";

interface CenterDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Box 본문 여백을 없앤다 — 목록이 가장자리까지 차야 할 때 */
  flush?: boolean;
}

/**
 * 화면 가운데 작은 팝업 (S15P21A405-686). 유리 상자(`Box`) 하나에 닫기 ✕, 바깥 클릭·ESC 로 닫힌다.
 *
 * **`document.body` 로 빼서 그린다** — 재생바·우측 패널 안에 두면 조상의 `transform`·`backdrop-filter` 가
 * `fixed` 의 기준이 되어 팝업이 그 상자 안에 갇힌다 (`song-report-dialog` 에 적힌 것과 같은 이유).
 */
export default function CenterDialog({ title, onClose, children, flush = false }: CenterDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div className="w-full max-w-sm animate-tin" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <Box
          title={title}
          flush={flush}
          actions={
            <IconButton label="닫기" onClick={onClose} className="text-ink-2!">
              <CloseIcon />
            </IconButton>
          }
        >
          {children}
        </Box>
      </div>
    </div>,
    document.body,
  );
}
