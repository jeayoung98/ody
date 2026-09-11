package com.ssafy.backend.realtime.presence.dto;

import jakarta.validation.constraints.NotNull;

/**
 * C→S /app/presence/join — 배치·복원(Q1 확정: "음악을 플레이해야 그 음악으로 위치가 이동").
 * 마지막 재생곡을 보내면 서버가 그 곡 좌표로 노출. play_history INSERT·만남 없음.
 * 서버는 musicId 를 play_history 최신 1건과 대조(불일치면 서버 값 — FE2 확인). 계약: FR-006.
 */
public record JoinRequest(@NotNull Integer layer, @NotNull Long musicId) {
}
