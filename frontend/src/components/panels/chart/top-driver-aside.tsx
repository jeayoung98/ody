"use client";

import { useEffect, useRef, useState } from "react";
import IconButton from "@/components/common/icon-button";
import { RefreshIcon } from "@/components/common/icons";
import { TOP_DRIVER } from "@/constants";
import { formatTimeAgo } from "@/lib/format";

interface TopDriverAsideProps {
  /** 마지막으로 받은 시각 (ms). 아직 못 받았으면 0 */
  updatedAt: number;
  /** 다시 받는 중 — 첫 로딩이 아니라 새로고침일 때 */
  fetching: boolean;
  onRefresh: () => void;
}

/**
 * 실시간 탑 버스기사 제목 옆 — **언제 값인지 + 새로고침** (S15P21A405-681).
 *
 * 주간 랭킹은 이 자리에 집계 구간을 적는데, 버스기사는 지금 상태라 그 대신 받은 시각을 적는다.
 * 사용자가 "이 값이 언제 것인지" 를 알아야 새로고침을 누를지 판단한다.
 *
 * 누른 뒤 `refreshCooldownMs` 동안은 막는다. 서버가 2초는 같은 답을 주므로 그 안에 눌러도 의미가 없다.
 * 도는 동안은 아이콘만 돈다 — 목록을 스켈레톤으로 바꾸면 화면이 튄다.
 */
export default function TopDriverAside({ updatedAt, fetching, onRefresh }: TopDriverAsideProps) {
  const [now, setNow] = useState(() => Date.now());
  const [cooling, setCooling] = useState(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TOP_DRIVER.agoTickMs);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (cooldown.current) clearTimeout(cooldown.current);
  }, []);

  const refresh = () => {
    setCooling(true);
    onRefresh();
    cooldown.current = setTimeout(() => setCooling(false), TOP_DRIVER.refreshCooldownMs);
  };

  return (
    <span className="flex items-center gap-1">
      {updatedAt > 0 && <span>{formatTimeAgo(new Date(updatedAt).toISOString(), Math.max(now, updatedAt))}</span>}
      <IconButton label="새로고침" size={22} onClick={refresh} disabled={cooling || fetching} className="disabled:opacity-40 disabled:hover:bg-transparent">
        <RefreshIcon className={fetching ? "animate-spin" : undefined} />
      </IconButton>
    </span>
  );
}
