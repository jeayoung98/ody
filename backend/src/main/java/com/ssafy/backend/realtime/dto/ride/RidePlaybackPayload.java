package com.ssafy.backend.realtime.dto.ride;

/**
 * S→C RIDE_PLAYBACK — 인솔자의 재생 조작을 동승자에게 그대로 넘긴다 (RT-34).
 *
 * <p>event 와 state 를 같이 주는 이유: SEEK·DRIFT 는 state 를 바꾸지 않으므로,
 * 받는 쪽이 "옮기기만 할지 틀기까지 할지"를 state 로 가른다.
 *
 * @param positionMs serverTs 시점의 재생 위치
 * @param serverTs 이 값의 기준 시각. 보낸 시각이 아니라 스냅샷의 updatedAt 이다 —
 *                 봉투의 ts(발송 시각)와 값이 다르므로 그걸로 대신할 수 없다
 */
public record RidePlaybackPayload(
		RidePlaybackEvent event,
		PlaybackState state,
		long positionMs,
		long serverTs) {
}
