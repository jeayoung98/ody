package com.ssafy.backend.realtime.service.play;

import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
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
 * 재생 선언 = 유일하게 위치를 이동시킴 (RT-02, /api/music/play). plan §F2.
 * 순서: presence 스냅샷(앵커·old·epoch) → 곡좌표 조회(서버 권위) → MusicPositionCalculator 배치 →
 *       applyPlay → play_history 저장 → 위치 변경 전달 → 만남 기록.
 *
 * realtime 프로파일에서만 활성. 클라이언트 좌표는 신뢰하지 않고 musicId 로 서버가 좌표를 계산한다.
 * REST 응답이 처리 결과이므로 여기서는 소켓 메시지를 직접 보내지 않는다.
 * 화면과 주변사람 갱신은 위치 변경을 받는 서비스가 담당한다.
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
	 * 재생 선언. 현재 레이어에서 musicId 의 서버 좌표를 계산해 위치를 이동시킨다.
	 *
	 * @param email   행위자(토큰 subject)
	 * @param musicId 재생 곡 id — 좌표 계산의 유일한 입력
	 * @param source  진입 경로(MAP/JOURNEY/PLAYLIST/FOLLOW) — play_history 기록용(③)
	 * @return {playHistoryId, musicId, layer, x, y, cellX, cellY}
	 * @throws CustomException PRESENCE_ERROR — 미연결/앵커없음/좌표없음/STALE(로그에 WebSocketErrorCode 사유)
	 */
	public PlayResponse play(String email, long musicId, String source) {
		// 1) 이 사람이 지금 접속해서 어느 레이어를 보고 있는지 가져온다(재생은 지금 보는 레이어에서 일어남).
		//    접속 안 했으면 NOT_CONNECTED, 레이어가 없으면(아직 자리 안 잡음) NO_ANCHOR 로 거부.
		PresenceSnapshot before = presenceRedisRepository.snapshot(email);
		if (before == null || before.epoch() == null) {
			log.warn("play 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_NOT_CONNECTED, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		if (before.layer() == null) {
			log.warn("play 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_NO_ANCHOR, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		int layer = before.layer();

		// 2) 곡 좌표는 서버가 musicId 로 직접 찾는다(클라가 보낸 좌표는 안 믿음). 없으면 거부.
		double[] pc = musicLocationService.findLocation(musicId)
				.orElseThrow(() -> {
					log.warn("play 거부 reason={} musicId={}", WebSocketErrorCode.PRESENCE_LOCATION_NULL, musicId);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});

		// 3) 그 곡 좌표를 지금 레이어의 격자 칸(셀)으로 바꾼다.
		Placement p = musicPositionCalculator.calculate(pc, layer);

		// 4) 레디스에 "이제 이 곡을 튼다"를 반영한다 — 이전 곡에서 빼고 새 곡에 넣기.
		//    여러 명령이 중간에 안 끼어들게 한 번에 처리한다. 돌아오는 값은 '같은 레이어에서 같은 곡을 듣던 사람들'(마주침 후보).
		List<String> meeting = presenceRedisRepository.applyPlay(
				email,
				before.musicId(), before.layer(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (meeting == null) {
			// 그 사이 이 사람 상태가 딴 데서 바뀜(예: 재접속) → 이번 재생은 무시(STALE).
			log.warn("play STALE reason={} musicId={}", WebSocketErrorCode.PRESENCE_STALE, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 5) "위치 바뀜" 알림을 하나 쏜다 — 이걸 받아서 화면 속 사람들·주변 사람 표시를 갱신한다.
		//    처음 트는 거면(이전 곡 없음) '새로 들어옴'으로 해석된다.
		String oldCell = before.musicId() == null ? null : before.cellX() + ":" + before.cellY();
		realtimeEventService.send(new PositionChanged(
				email, before.epoch(), layer,
				before.musicId(), musicId,
				oldCell, p.cellKey(),
				p.xNorm(), p.yNorm()));

		// 6) 재생 기록(play_history)을 한 줄 남긴다. id 는 자동으로 채워진다.
		//    재생 시간(played_ms)은 지금은 시작이라 0, 곡이 끝날 때(playEnd) 실제 시간으로 바꾼다.
		PlayHistoryRow history = new PlayHistoryRow();
		history.setMusicId(musicId);
		history.setEmail(email);
		history.setSource(source);
		history.setPlayedMs(0L);
		playHistoryMapper.insert(history);

		// 7) 마주침 기록 — 위 후보들과의 만남을 뒤에서(비동기) 세어 준다(3분 쿨다운, 응답 안 막음).
		meetingService.recordMeetings(email, meeting);

		log.info("[Play] 재생 선언 완료 musicId={} layer={} playHistoryId={}", musicId, layer, history.getId());
		return new PlayResponse(history.getId(), musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
	}

	/** 재생 종료 — played_ms 갱신(멱등, 소유자 검증). 위치 불변. 대상 없음/비소유면 PRESENCE_ERROR. */
	public void playEnd(String email, long playHistoryId, long playedMs) {
		int updated = playHistoryMapper.updatePlayedMs(playHistoryId, email, playedMs);
		if (updated == 0) {
			log.warn("playEnd 대상 없음/비소유 playHistoryId={}", playHistoryId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		log.info("[Play] 재생 종료 완료 playHistoryId={} playedMs={}", playHistoryId, playedMs);
	}
}
