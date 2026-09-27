package com.ssafy.backend.realtime.dto.ride;

/**
 * 그룹이 지금 트는 곡. 읽는 시점 기준으로 계산이 끝난 값이다.
 * 저장된 값({@code RideRedisRepository.PlaybackSnapshot})과 달리 positionMs 가 "지금 위치"다.
 */
public record RidePlayback(long musicId, PlaybackState state, long positionMs, long snapshotSeq) {
}
