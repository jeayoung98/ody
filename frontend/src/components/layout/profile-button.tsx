"use client";

import Avatar from "@/components/common/avatar";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 우상단 맨 오른쓱 — 내 프로필. 아이콘 대신 **내 프사**다 (S15P21A405-434).
 * 다른 탭과 알약을 같이 쓰지 않는다: "나" 는 목적지가 아니라 주인이라 따로 선다.
 * 누르면 내 프로필 패널을 연다/닫는다. 열려 있으면 테두리가 teal 로 켜진다.
 */
export default function ProfileButton() {
  const { data: me } = useMeQuery();
  const active = usePanelStore((s) => s.activePanel) === "feed";
  const toggle = usePanelStore((s) => s.toggle);
  return (
    <button
      type="button"
      title="내 프로필"
      aria-label="내 프로필"
      aria-pressed={active}
      data-tutorial="feed"
      onClick={() => toggle("feed")}
      className={`glass-liquid grid h-11 w-11 place-items-center rounded-pill! transition-colors duration-fast hover:border-line-2 ${active ? "border-teal/60! shadow-glow-azure" : ""}`}
    >
      <Avatar src={me?.imageUrl} name={me?.nickname ?? me?.name} size={32} />
    </button>
  );
}
