"use client";

import CenterDialog from "@/components/common/center-dialog";
import CreatePlaylistForm from "./create-playlist-form";

/** 새 플레이리스트 만들기 팝업 (PATH-03, S15P21A405-686). 만들면 닫힌다 */
export default function CreatePlaylistDialog({ onClose }: { onClose: () => void }) {
  return (
    <CenterDialog title="새 플레이리스트" onClose={onClose}>
      <CreatePlaylistForm autoFocus onCreated={onClose} />
    </CenterDialog>
  );
}
