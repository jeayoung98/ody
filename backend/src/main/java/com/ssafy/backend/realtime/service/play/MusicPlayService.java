package com.ssafy.backend.realtime.service.play;

import java.util.List;
import java.util.Objects;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.dto.play.PlayHistoryRow;
import com.ssafy.backend.realtime.dto.play.PlayResponse;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.ride.RiderMoveService;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 곡 재생을 처리한다.
 * 재생하면 곡 위치로 옮기고, 재생 기록과 만남을 저장한다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class MusicPlayService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicLocationService musicLocationService;
	private final MusicPositionCalculator musicPositionCalculator;
	private final RealtimeEventService realtimeEventService;
	private final PlayHistoryMapper playHistoryMapper;
	private final MeetingService meetingService;
	private final RiderMoveService riderMoveService;

	/**
	 * 곡 위에 사람을 올린 결과.
	 * coResidents 는 올라가기 직전 그 자리에 있던 사람들이다 — 만남으로 셀지는 부르는 쪽이 정한다.
	 */
	public record Placed(long playHistoryId, int layer, double x, double y,
			int cellX, int cellY, List<String> coResidents) {
	}

	/**
	 * 곡을 재생하고 그 곡 위치로 사용자를 옮긴다.
	 *
	 * 레이어는 서버에 있는 값을 우선한다 — 재생으로 레이어가 바뀌지 않는다.
	 * 아직 지도에 서 있지 않은 사용자(첫 재생)만 요청의 layer 로 자리를 잡는다.
	 * 둘 다 없으면 어느 레이어에 놓을지 알 수 없어 거부한다.
	 *
	 * @param email 사용자 이메일
	 * @param musicId 재생할 곡 ID
	 * @param source 곡을 재생한 화면
	 * @param requestedLayer 첫 배치일 때 놓을 레이어. 이미 서 있으면 무시된다
	 * @return 재생 기록 ID와 새 위치
	 * @throws CustomException 접속 정보나 곡 위치를 찾을 수 없는 경우
	 */
	@Transactional
	public PlayResponse play(String email, long musicId, String source, Integer requestedLayer) {
		// 1. 사용자의 현재 곡과 레이어를 읽는다.
		PresenceSnapshot before = presenceRedisRepository.snapshot(email);
		if (before == null || before.epoch() == null) {
			log.warn("play 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_NOT_CONNECTED, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		// 서 있는 레이어가 있으면 그대로, 없으면(첫 재생) 요청 값으로 자리를 잡는다.
		Integer resolvedLayer = before.layer() != null ? before.layer() : requestedLayer;
		if (resolvedLayer == null) {
			log.warn("play 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_LAYER_INVALID, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 2. 나를 따라오는 사람이 있는지 먼저 본다. 있으면 같이 옮기고 기록도 같이 넣는다.
		//    따로 넣으면 재생수를 두 번 고치게 된다.
		List<String> riders = riderMoveService.ridersOf(email);
		Placed placed = riders.isEmpty()
				? placeOnMusic(email, before, musicId, resolvedLayer, source)
				: placeWithRiders(email, before, musicId, resolvedLayer, source, riders);

		// 3. 아무도 들은 적 없는 곡이면 이 사람이 발견자로 기록된다 (주간 발견왕 랭킹, S15P21A405-448).
		//    이미 기록이 있으면 아무 일도 일어나지 않는다.
		//    따라오는 사람은 발견자가 될 수 없다 — 찾아간 것이 아니라 따라온 것이다.
		playHistoryMapper.insertDiscovery(musicId, email);

		// 4. 같은 곡에서 만난 사용자들을 기록한다.
		//    따라오는 사람은 여기 들어오지 않는다 — 지도에 올리지 않아 애초에 명단에 없다.
		meetingService.recordMeetings(email, placed.coResidents());

		log.info("[Play] 재생 선언 완료 musicId={} layer={} playHistoryId={}",
				musicId, placed.layer(), placed.playHistoryId());
		return new PlayResponse(placed.playHistoryId(), musicId, placed.layer(),
				placed.x(), placed.y(), placed.cellX(), placed.cellY());
	}

	/**
	 * 사람을 곡 위로 옮기고 재생 기록을 남긴다. 재생과 따라가기가 같이 쓴다.
	 *
	 * 발견자 기록과 만남 기록은 여기서 하지 않는다 — 따라가기는 둘 다 하면 안 되기 때문이다.
	 * 따라가는 사람이 발견자가 되면 안 되고, 따라붙은 것은 만남이 아니다.
	 *
	 * @param before 옮기기 전 상태. 부르는 쪽이 읽어서 넘긴다
	 * @param layer 놓을 레이어. 재생은 서 있던 레이어, 따라가기는 인솔자의 레이어다
	 * @return 새 위치와 올라가기 직전 그 자리에 있던 사람들
	 * @throws CustomException 곡이 없거나 지도에 놓을 수 없는 경우
	 */
	@Transactional
	public Placed placeOnMusic(String email, PresenceSnapshot before, long musicId, int layer, String source) {
		Moved moved = moveOntoMusic(email, before, musicId, layer);
		long playHistoryId = recordPlay(email, musicId, source);
		notifyMoved(email, before, musicId, layer, moved.placement());
		return moved.toPlaced(playHistoryId, layer);
	}

	/**
	 * 인솔자를 옮기고, 따라오는 사람들도 같이 옮긴 뒤, 기록을 한 번에 넣는다.
	 *
	 * 지도에 나가는 위치 변경 알림은 인솔자 것 한 건뿐이다. 따라오는 사람은 지도에 올리지 않아
	 * 알릴 자리 자체가 없다. 이게 사람이 몇이든 알림이 1건인 이유다.
	 */
	private Placed placeWithRiders(String email, PresenceSnapshot before, long musicId, int layer,
			String source, List<String> riders) {
		Moved moved = moveOntoMusic(email, before, musicId, layer);
		long playHistoryId = riderMoveService.moveAll(
				email, riders, musicId, layer, moved.placement(), moved.rawX(), moved.rawY(), source);
		notifyMoved(email, before, musicId, layer, moved.placement());
		return moved.toPlaced(playHistoryId, layer);
	}

	/** 옮겨진 자리. 기록을 누가 넣을지는 부르는 쪽이 정한다. */
	private record Moved(Placement placement, double rawX, double rawY, List<String> coResidents) {
		Placed toPlaced(long playHistoryId, int layer) {
			return new Placed(playHistoryId, layer, rawX, rawY,
					placement.cellX(), placement.cellY(), coResidents);
		}
	}

	/**
	 * 사람을 곡 위로 옮기기만 한다. 기록도 알림도 하지 않는다.
	 *
	 * @throws CustomException 곡이 없거나 지도에 놓을 수 없는 경우
	 */
	private Moved moveOntoMusic(String email, PresenceSnapshot before, long musicId, int layer) {
		// 1. 곡의 좌표를 찾는다.
		//    좌표가 없으면 곡 자체가 없는지(404) 곡은 있는데 지도에 못 놓는지(422) 갈라서 알린다.
		double[] pc = musicLocationService.findLocation(musicId)
				.orElseThrow(() -> {
					if (!musicLocationService.exists(musicId)) {
						log.warn("배치 거부 reason=MUSIC_NOT_FOUND musicId={}", musicId);
						return new CustomException(MusicErrorCode.MUSIC_NOT_FOUND);
					}
					log.warn("배치 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_LOCATION_NULL, musicId);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});

		// 2. 곡 좌표를 그 레이어의 위치와 셀로 바꾼다.
		Placement p = musicPositionCalculator.calculate(pc, layer);

		// 3. 이전 곡에서 빼고 새 곡에 넣는다.
		List<String> coResidents = presenceRedisRepository.applyPlay(
				email,
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (coResidents == null) {
			// 처리 중 접속 상태가 바뀌면 이번 배치를 거부한다.
			log.warn("배치 STALE reason={} musicId={}", WebSocketErrorCode.PRESENCE_STALE, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// x·y 는 지도(뷰포트 요청·셀 인원수)와 같은 원시 PC 좌표. 정규화 값은 셀 계산 내부용이다.
		return new Moved(p, pc[p.axisX() - 1], pc[p.axisY() - 1], coResidents);
	}

	/** 실제 위치가 바뀌었을 때만 화면과 주변사람 목록에 알린다. */
	private void notifyMoved(String email, PresenceSnapshot before, long musicId, int layer, Placement p) {
		String oldCell = before.musicId() == null ? null : before.cellX() + ":" + before.cellY();
		if (before.musicId() == null
				|| !Objects.equals(before.musicId(), musicId)
				|| !Objects.equals(before.layer(), layer)
				|| !Objects.equals(oldCell, p.cellKey())) {
			realtimeEventService.send(new PositionChanged(
					email, before.epoch(), before.musicId() == null ? null : before.layer(), layer,
					before.musicId(), musicId,
					oldCell, p.cellKey(),
					p.xNorm(), p.yNorm()));
		}
	}

	/**
	 * 재생 기록을 남기고 재생수를 올린다.
	 *
	 * 발견자 기록과 만남 기록은 하지 않는다 — 부르는 쪽이 정한다.
	 * 지도 위치도 건드리지 않는다. 따라가기처럼 지도에 넣지 않고 듣기만 하는 경우가 있다.
	 *
	 * @return 재생 기록 ID
	 */
	@Transactional
	public long recordPlay(String email, long musicId, String source) {
		PlayHistoryRow history = new PlayHistoryRow();
		history.setMusicId(musicId);
		history.setEmail(email);
		history.setSource(source);
		playHistoryMapper.insert(history);
		// 재생수: play_history 한 줄 = play_cnt +1. 같은 트랜잭션이라 둘 중 하나만 남지 않는다.
		playHistoryMapper.incrementPlayCnt(musicId);
		return history.getId();
	}
}
