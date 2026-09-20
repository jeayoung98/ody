package com.ssafy.backend.realtime.service.ride;

import java.time.Clock;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PlaybackSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 그룹이 지금 무슨 곡을 어디서부터 틀고 있는지 알려준다.
 * 저장된 값은 바뀐 순간의 위치라, 읽을 때마다 그 뒤 흐른 시간을 더해서 준다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RidePlaybackService {

	private final RideRedisRepository rideRedisRepository;
	private final PresenceRedisRepository presenceRedisRepository;
	private final Clock clock;

	/**
	 * 지금 트는 곡을 읽는다.
	 * 아직 저장된 게 없으면 인솔자가 서 있는 곡으로 처음부터 만든다.
	 *
	 * @return 인솔자가 곡 위에 없으면 null
	 */
	public RidePlayback read(String captainEmail) {
		long now = clock.millis();

		// 1. 저장된 게 있으면 지금 위치를 계산해서 준다.
		PlaybackSnapshot saved = rideRedisRepository.findPlayback(captainEmail);
		if (saved != null) {
			return new RidePlayback(saved.musicId(), saved.state(),
					saved.positionAt(now), saved.snapshotSeq());
		}

		// 2. 없으면 인솔자가 혼자 듣는 동안 한 번도 안 바뀐 것이다.
		//    인솔자가 서 있는 곡을 그대로 쓴다. 어디까지 들었는지는 알 방법이 없어 처음부터다.
		PresenceSnapshot presence = presenceRedisRepository.snapshot(captainEmail);
		if (presence == null || presence.musicId() == null) {
			return null;
		}

		// 3. 만든 값을 저장해 둔다. 안 그러면 다음 사람도 또 처음부터 듣게 된다.
		long snapshotSeq = rideRedisRepository.savePlayback(
				captainEmail, presence.musicId(), PlaybackState.PLAYING, 0L, now);
		log.info("[Ride] 재생 스냅샷 최초 생성 musicId={} snapshotSeq={}", presence.musicId(), snapshotSeq);
		return new RidePlayback(presence.musicId(), PlaybackState.PLAYING, 0L, snapshotSeq);
	}
}
