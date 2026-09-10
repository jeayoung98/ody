"use client";

import { useConfirmStore } from "@/stores/use-confirm-store";
import Box from "./box";
import Button from "./button";

/** 전역 확인 팝업. useConfirmStore.ask() 로 띄운다 */
export default function ConfirmDialog() {
  const pending = useConfirmStore((s) => s.pending);
  const confirm = useConfirmStore((s) => s.confirm);
  const cancel = useConfirmStore((s) => s.cancel);
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay backdrop-blur-sm" onClick={cancel} role="presentation">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm animate-tin" role="dialog" aria-modal="true" aria-label={pending.title}>
        <Box title={pending.title}>
          <p className="text-sm leading-relaxed text-ink-2">{pending.message}</p>
          <div className="mt-1 flex justify-end gap-2">
            <Button onClick={cancel}>{pending.cancelLabel}</Button>
            <Button variant="primary" onClick={confirm} autoFocus>
              {pending.confirmLabel}
            </Button>
          </div>
        </Box>
      </div>
    </div>
  );
}
