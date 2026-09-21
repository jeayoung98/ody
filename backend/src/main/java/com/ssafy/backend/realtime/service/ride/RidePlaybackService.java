package com.ssafy.backend.realtime.service.ride;

import java.time.Clock;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RidePlayback;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackEvent;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackPayload;
import com.ssafy.backend.realtime.dto.ride.RidePlaybackRequest;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.error.WebSocketRequestException;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository.PlaybackSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 그룹이 지금 무슨 곡을 어디서부터 틀고 있는지 알려주고, 인솔자의 재생 조작을 따라오는 사람들에게 넘긴다.
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
	private final RideGuard rideGuard; // 따라가는 사람이 보낸 조작을 막는다
	private final RealtimeMessageService realtimeMessageService; // 따라오는 사람 개인 큐로 발송

	/**
	 * 지금 트는 곡을 읽는다.
	 * 아직 저장된 게 없으면 인솔자가 서 있는 곡을 처음으로 만든다.
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

	/**
	 * 인솔자가 한 재생 조작을 따라오는 사람들에게 그대로 넘긴다.
	 *
	 * @param captainEmail 조작을 보낸 사람
	 * @param request 조작 종류와 그때의 재생 위치
	 * @throws WebSocketRequestException 따라가는 사람이 보냈거나, 보낸 사람이 곡 위에 없을 때
	 */
	public void relay(String captainEmail, RidePlaybackRequest request) {
		request.validate();

		// 1. 따라가는 사람이 보낸 조작은 받지 않는다. 받으면 남의 재생을 마음대로 돌리게 된다.
		rideGuard.requireNotRiding(captainEmail, "재생 조작을 보낼");

		// 2. 지금 트는 곡을 읽는다. 곡 위에 없으면 넘길 내용 자체가 없다.
		RidePlayback current = read(captainEmail);
		if (current == null) {
			throw new WebSocketRequestException(WebSocketErrorCode.PRESENCE_NOT_CONNECTED,
					"곡 위에 있지 않아 재생 조작을 보낼 수 없다");
		}

		// 3. 새 상태를 정해 저장한다. 나중에 타는 사람은 이 값으로 같은 지점부터 듣는다.
		//	  보내기 전에 저장해야, 발송과 거의 동시에 들어온 사람도 바뀐 값을 본다.
		long now = clock.millis();
		PlaybackState state = nextState(request.event(), current.state());
		rideRedisRepository.savePlayback(
				captainEmail, current.musicId(), state, request.positionMs(), now);

		// 4. 따라오는 사람이 없으면 저장만 하고 끝낸다.
		Set<String> riders = rideRedisRepository.riders(captainEmail);
		if (riders.isEmpty()) {
			return;
		}

		// 5. 각자 개인 큐로 넘긴다. 위치의 기준 시각을 같이 줘야 받는 쪽이 늦게 도착한 만큼을 더할 수 있다.
		RidePlaybackPayload payload = new RidePlaybackPayload(
				request.event(), state, request.positionMs(), now);
		for (String rider : riders) {
			realtimeMessageService.sendToUser(rider, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_PLAYBACK, payload);
		}
	}

	/**
	 * 조작 종류에 따라 멈춤·재생 상태를 정한다.
	 * 재생바를 옮기거나 어긋남을 맞추는 건 위치만 바꾸는 일이라 상태는 그대로 둔다.
	 */
	private static PlaybackState nextState(RidePlaybackEvent event, PlaybackState current) {
		return switch (event) {
			case PLAY -> PlaybackState.PLAYING;
			case PAUSE -> PlaybackState.PAUSED;
			case SEEK, DRIFT -> current;
		};
	}
}
