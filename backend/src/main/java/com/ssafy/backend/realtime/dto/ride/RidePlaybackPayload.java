package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_PLAYBACK — 인솔자의 재생 조작을 따라가는 사람들에게 그대로 넘긴다.
 *
 * event 와 state 를 같이 주는 이유: 재생바만 옮긴 경우는 멈춤·재생 상태가 그대로라,
 * 받는 쪽이 "옮기기만 할지 틀기까지 할지"를 state 로 가른다.
 *
 * @param positionMs serverTs 시점의 재생 위치
 * @param serverTs 이 위치의 기준 시각. 보낸 시각이 아니라 저장해 둔 시각이다 —
 *                 봉투의 ts(보낸 시각)와 값이 달라 그걸로 대신할 수 없다
 */
public record RidePlaybackPayload(
		RidePlaybackEvent event,
		PlaybackState state,
		long positionMs,
		long serverTs) {
}
