"use client";

import { useState } from "react";
import Box from "@/components/common/box";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import Tabs from "@/components/common/tabs";
import { CHART_TYPES, type ChartType } from "@/constants";
import PanelCloseButton from "../panel-close-button";
import PlaylistRankingList from "./playlist-ranking-list";
import UserRankingList from "./user-ranking-list";

const TAB_ITEMS = CHART_TYPES.map((c) => ({ key: c.key, label: c.label.replace("실시간 ", "").replace("누적 ", "") }));

/** 차트: 탑 버스기사 · 이번주 탐험왕 · 누적 팔로워 · 탑 플레이리스트 (SOCIAL-12) */
export default function ChartPanel() {
  const [type, setType] = useState<ChartType>("topDriver");
  const current = CHART_TYPES.find((c) => c.key === type)!;

  return (
    <Box title="차트" code="SOCIAL-12" actions={<PanelCloseButton />}>
      <Tabs items={TAB_ITEMS} value={type} onChange={setType} />
      <SectionTitle>{current.label}</SectionTitle>
      <div className="-mx-1.5 flex flex-col gap-0.5">{type === "topPlaylist" ? <PlaylistRankingList /> : <UserRankingList type={type} />}</div>
      <Note>{current.description}</Note>
    </Box>
  );
}
