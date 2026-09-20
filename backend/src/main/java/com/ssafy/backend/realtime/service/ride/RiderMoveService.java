package com.ssafy.backend.realtime.service.ride;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;
import com.ssafy.backend.realtime.dto.ride.PlaybackState;
import com.ssafy.backend.realtime.dto.ride.RideTrackPayload;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 인솔자가 곡을 바꾸면 따라오는 사람들을 같은 곡으로 같이 옮긴다.
 *
 * 옮길 때 지도 인덱스에는 넣지 않는다. 남들 화면에는 인솔자 한 점과 인원수로만 보인다.
 * 그래서 인솔자가 곡을 바꿔도 지도에 나가는 위치 변경 알림은 사람 수와 상관없이 1건이다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class RiderMoveService {

	private final RideRedisRepository rideRedisRepository;
	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicLocationService musicLocationService;
	private final PlayHistoryMapper playHistoryMapper;
	private final RealtimeMessageService realtimeMessageService;
	private final Clock clock;

	/** 나를 따라오는 사람들. 없으면 빈 목록이고, 그때는 옮길 것도 알릴 것도 없다. */
	public List<String> ridersOf(String captainEmail) {
		Set<String> riders = rideRedisRepository.riders(captainEmail);
		return riders.isEmpty() ? List.of() : List.copyOf(riders);
	}

	/**
	 * 인솔자와 따라오는 사람들을 새 곡으로 옮기고, 기록을 한 번에 넣고, 새 곡을 알린다.
	 *
	 * 인솔자는 이 메서드를 부르기 전에 이미 옮겨져 있다. 여기서는 기록만 같이 넣는다 —
	 * 따로 넣으면 재생수를 두 번 고치게 된다.
	 *
	 * @param placement 인솔자가 옮겨 간 자리. 따라오는 사람도 같은 자리에 선다
	 * @param rawX 지도에 그릴 때 쓰는 가로 위치. 자리 계산용 값과 달리 지도와 같은 눈금이다
	 * @param rawY 지도에 그릴 때 쓰는 세로 위치
	 * @return 인솔자 자신의 재생 기록 번호
	 */
	public long moveAll(String captainEmail, List<String> riders,
			long musicId, int layer, Placement placement, double rawX, double rawY, String source) {
		long now = clock.millis();

		// 1. 한 명씩 옮긴다. 옮기지 못한 사람은 건너뛴다 — 나머지까지 멈출 이유가 없다.
		List<String> moved = moveRiders(riders, musicId, layer, placement);

		// 2. 인솔자와 옮겨진 사람들의 기록을 한 문장으로 넣고 재생수도 한 번에 올린다.
		List<String> listeners = new ArrayList<>();
		listeners.add(captainEmail);
		listeners.addAll(moved);
		List<Long> ids = insertPlayHistory(listeners, musicId, source);
		playHistoryMapper.incrementPlayCntBy(musicId, listeners.size());

		// 3. 지금 트는 곡을 새 곡으로 바꾼다. 새 곡이니 위치는 0 이고, 시작 시각은 지금이다.
		//    나중에 타는 사람은 이 두 값으로 "곡이 시작되고 몇 초 지났는지"를 계산해 그 지점부터 듣는다.
		//    시작 시각을 안 고치면 앞 곡 기준으로 계산해 엉뚱한 지점부터 듣게 된다.
		rideRedisRepository.savePlayback(captainEmail, musicId, PlaybackState.PLAYING, 0L, now);

		// 4. 옮겨진 사람에게만 새 곡을 알린다.
		notifyTrack(moved, musicId, layer, rawX, rawY, now);

		log.info("[Ride] 곡 이동 musicId={} layer={} riders={}", musicId, layer, moved.size());
		return ids.get(0);
	}

	/**
	 * 따라오는 사람들을 인솔자 자리로 옮긴다.
	 *
	 * 옮기기 전 자리는 각자에게서 읽는다. 대부분 인솔자가 있던 앞 곡이지만,
	 * 막 탄 사람은 이미 새 곡에 서 있을 수 있어 사람마다 확인해야 한다.
	 *
	 * @return 실제로 옮겨진 사람들
	 */
	private List<String> moveRiders(List<String> riders, long musicId, int layer, Placement placement) {
		List<String> moved = new ArrayList<>();
		for (String rider : riders) {
			PresenceSnapshot before = presenceRedisRepository.snapshot(rider);
			if (before == null || before.epoch() == null) {
				log.warn("따라가기 이동 건너뜀 reason=NOT_CONNECTED");
				continue;
			}
			boolean ok = presenceRedisRepository.applyRidePlacement(
					rider, before.epoch(),
					before.musicId(), before.layer(), before.cellX(), before.cellY(),
					musicId, layer,
					placement.xNorm(), placement.yNorm(), placement.cellX(), placement.cellY());
			if (!ok) {
				log.warn("따라가기 이동 건너뜀 reason=STALE");
				continue;
			}
			moved.add(rider);
		}
		return moved;
	}

	/**
	 * 들은 사람들의 기록을 한 번에 넣는다.
	 *
	 * 번호를 먼저 받아 두는 이유는 넣은 뒤에 돌려받지 않아도 되기 때문이다.
	 * 인솔자 번호는 응답에 실어야 해서 순서를 그대로 지킨다.
	 *
	 * @return 넣은 순서 그대로의 기록 번호. 첫 번째가 인솔자다
	 */
	private List<Long> insertPlayHistory(List<String> listeners, long musicId, String source) {
		List<Long> ids = playHistoryMapper.nextIds(listeners.size());
		List<PlayHistoryRow> rows = new ArrayList<>();
		for (int i = 0; i < listeners.size(); i++) {
			PlayHistoryRow row = new PlayHistoryRow();
			row.setId(ids.get(i));
			row.setMusicId(musicId);
			row.setEmail(listeners.get(i));
			row.setSource(source);
			rows.add(row);
		}
		playHistoryMapper.insertBatch(rows);
		return ids;
	}

	/** 새 곡을 각자에게 알린다. 소리를 틀 수 있는 곡인지는 한 번만 확인해 모두에게 같은 값을 보낸다. */
	private void notifyTrack(List<String> riders, long musicId, int layer,
			double rawX, double rawY, long now) {
		if (riders.isEmpty()) {
			return;
		}
		boolean playable = musicLocationService.playable(musicId);
		RideTrackPayload payload = new RideTrackPayload(musicId, layer, rawX, rawY, playable, now);
		for (String rider : riders) {
			realtimeMessageService.sendToUser(rider, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.RIDE_TRACK, payload);
		}
	}
}
