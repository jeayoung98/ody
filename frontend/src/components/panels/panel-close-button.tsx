"use client";

import IconButton from "@/components/common/icon-button";
import { CloseIcon } from "@/components/common/icons";
import { usePanelStore } from "@/stores/use-panel-store";

export default function PanelCloseButton() {
  const close = usePanelStore((s) => s.close);
  return (
    <IconButton label="패널 닫기" onClick={close}>
      <CloseIcon />
    </IconButton>
  );
}
