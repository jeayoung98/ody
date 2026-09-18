package com.ssafy.backend.realtime.service.play;

import java.util.List;
import java.util.Objects;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
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
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 곡 재생과 종료를 처리한다.
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
		int layer = resolvedLayer;

		// 2. 재생할 곡의 좌표를 찾는다.
		//    좌표가 없으면 곡 자체가 없는지(404) 곡은 있는데 지도에 못 놓는지(422) 갈라서 알린다.
		double[] pc = musicLocationService.findLocation(musicId)
				.orElseThrow(() -> {
					if (!musicLocationService.exists(musicId)) {
						log.warn("play 거부 reason=MUSIC_NOT_FOUND musicId={}", musicId);
						return new CustomException(MusicErrorCode.MUSIC_NOT_FOUND);
					}
					log.warn("play 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_LOCATION_NULL, musicId);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});

		// 3. 곡 좌표를 현재 레이어의 위치와 셀로 바꾼다.
		Placement p = musicPositionCalculator.calculate(pc, layer);

		// 4. 이전 곡에서 빼고 새 곡에 넣는다.
		List<String> meeting = presenceRedisRepository.applyPlay(
				email,
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (meeting == null) {
			// 처리 중 접속 상태가 바뀌면 이번 재생을 거부한다.
			log.warn("play STALE reason={} musicId={}", WebSocketErrorCode.PRESENCE_STALE, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 5. 재생 기록을 만들고 재생 시간은 0으로 시작한다.
		PlayHistoryRow history = new PlayHistoryRow();
		history.setMusicId(musicId);
		history.setEmail(email);
		history.setSource(source);
		history.setPlayedMs(0L);
		playHistoryMapper.insert(history);
		// 재생수: play_history 한 줄 = play_cnt +1. 같은 트랜잭션이라 둘 중 하나만 남지 않는다.
		playHistoryMapper.incrementPlayCnt(musicId);
		// 아무도 들은 적 없는 곡이면 이 사람이 발견자로 기록된다 (주간 발견왕 랭킹, S15P21A405-448).
		// 이미 기록이 있으면 아무 일도 일어나지 않는다.
		playHistoryMapper.insertDiscovery(musicId, email);

		// 6. 실제 위치가 바뀌었을 때만 화면과 주변사람 목록에 알린다.
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

		// 7. 같은 곡에서 만난 사용자들을 기록한다.
		meetingService.recordMeetings(email, meeting);

		log.info("[Play] 재생 선언 완료 musicId={} layer={} playHistoryId={}", musicId, layer, history.getId());
		return new PlayResponse(history.getId(), musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
	}

	/**
	 * 재생 시간을 저장한다. 지도 위치와 노출은 그대로 둔다.
	 *
	 * 내 기록이 아니거나 없는 기록이면 403 으로 거부한다. 둘을 구분하지 않는다 —
	 * 구분하면 남의 기록 ID 가 존재하는지 알아낼 수 있어서(존재 유무 비노출, 계약 §2).
	 *
	 * @param email 사용자 이메일
	 * @param playHistoryId 재생 기록 ID
	 * @param playedMs 재생한 시간
	 * @throws CustomException 내 기록이 아니거나 없는 기록이면 FORBIDDEN
	 */
	public void playEnd(String email, long playHistoryId, long playedMs) {
		int updated = playHistoryMapper.updatePlayedMs(playHistoryId, email, playedMs);
		if (updated == 0) {
			log.warn("playEnd 거부 reason=FORBIDDEN playHistoryId={}", playHistoryId);
			throw new CustomException(GlobalErrorCode.FORBIDDEN);
		}
		log.info("[Play] 재생 종료 완료 playHistoryId={} playedMs={}", playHistoryId, playedMs);
	}
}
