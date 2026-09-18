package com.ssafy.backend.realtime.dto.presence;

/** 입장이 끝난 뒤 실제로 적용된 곡과 레이어를 알린다. */
public record PresenceJoined(long requestSeq, int layer, long musicId) {
}
