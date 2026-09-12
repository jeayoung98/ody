package com.ssafy.backend.realtime.play;

import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.common.PositionChanged;
import com.ssafy.backend.realtime.common.RealtimeErrorCode;
import com.ssafy.backend.realtime.common.RealtimeErrorCode.WsCode;
import com.ssafy.backend.realtime.common.RealtimeEventBus;
import com.ssafy.backend.realtime.geometry.CoordinateMapper;
import com.ssafy.backend.realtime.geometry.CoordinateMapper.Placement;
import com.ssafy.backend.realtime.play.dto.PlayResponse;
import com.ssafy.backend.realtime.port.MusicLocationPort;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 재생 선언 = 유일하게 위치를 이동시킴 (RT-02, /api/music/play). plan §F2.
 * 순서: presence 스냅샷(앵커·old·epoch) → 곡좌표 조회(서버 권위) → CoordinateMapper 배치 →
 *       applyPlay(원자) → play_history INSERT(③) → 위치변경 EventBus 발행 → 만남(④, 비동기).
 *
 * realtime 프로파일에서만 활성. 클라이언트 좌표는 신뢰하지 않고 musicId 로 서버가 좌표를 계산한다.
 * REST 응답 자체가 ack 이므로 여기서 publisher(user push)는 쓰지 않는다
 * (뷰포트/근처 델타는 EventBus 구독자 RT-22/11 가 담당).
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class PlayDeclarationService {

	private final PresenceRedisRepository presenceRedisRepository;
	private final MusicLocationPort musicLocationPort;
	private final CoordinateMapper coordinateMapper;
	private final RealtimeEventBus eventBus;

	/**
	 * 재생 선언. 현재 레이어에서 musicId 의 서버 좌표를 계산해 위치를 이동시킨다.
	 *
	 * @param email   행위자(토큰 subject)
	 * @param musicId 재생 곡 id — 좌표 계산의 유일한 입력
	 * @param source  진입 경로(MAP/JOURNEY/PLAYLIST/FOLLOW) — play_history 기록용(③)
	 * @return {playHistoryId, musicId, layer, x, y, cellX, cellY}
	 * @throws CustomException PRESENCE_ERROR — 미연결/앵커없음/좌표없음/STALE(로그에 WsCode 사유)
	 */
	public PlayResponse play(String email, long musicId, String source) {
		// 1) 앵커 확인 — 재생은 '현재 레이어'에서 일어난다(연결+join 이후).
		PresenceSnapshot before = presenceRedisRepository.snapshot(email);
		if (before == null || before.epoch() == null) {
			log.warn("play 거부 reason={} musicId={}", WsCode.PRESENCE_NOT_CONNECTED, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		if (before.layer() == null) {
			log.warn("play 거부 reason={} musicId={}", WsCode.PRESENCE_NO_ANCHOR, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		int layer = before.layer();

		// 2) 서버가 좌표 받음— 클라 좌표 불신, musicId 로 music.location 조회.
		double[] pc = musicLocationPort.findLocation(musicId)
				.orElseThrow(() -> {
					log.warn("play 거부 reason={} musicId={}", WsCode.PRESENCE_LOCATION_NULL, musicId);
					return new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
				});

		// 3) 현재 레이어의 격자 셀로 배치.
		Placement p = coordinateMapper.place(pc, layer);

		// 4) 곡 변경 원자 갱신(presence-play.lua). old 는 snapshot 에서, 반환은 만남 후보(④).
		List<String> meeting = presenceRedisRepository.applyPlay(
				email,
				before.musicId(), before.cellX(), before.cellY(),
				musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
		if (meeting == null) {
			// old 불일치/미연결 — 다른 세션이 먼저 이동시킴(재접속 epoch 경쟁 등).
			log.warn("play STALE reason={} musicId={}", WsCode.PRESENCE_STALE, musicId);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}

		// 5) 위치변경 이벤트 — 뷰포트(RT-22)·근처(RT-11) 델타의 공통 입력(인프로세스).
		//    진입(old 없음)이면 oldMusicId/oldCell = null → PositionChanged 가 ENTER 로 해석.
		String oldCell = before.musicId() == null ? null : before.cellX() + ":" + before.cellY();
		eventBus.publish(new PositionChanged(
				email, before.epoch(), layer,
				before.musicId(), musicId,
				oldCell, p.cellKey(),
				p.xNorm(), p.yNorm()));

		// TODO(③): play_history INSERT(source 포함) → 실제 playHistoryId 채움.
		// TODO(④): meeting(진입 직전 청취자) 로 만남 비동기 판정.
		long playHistoryId = 0L; // ③ 이전 placeholder
		return new PlayResponse(playHistoryId, musicId, layer, p.xNorm(), p.yNorm(), p.cellX(), p.cellY());
	}

	/** 재생 종료 — played_ms 갱신(멱등, 소유자 검증). 위치 불변. */
	public void playEnd(String email, long playHistoryId, long playedMs) {
		throw new UnsupportedOperationException("TODO(③)");
	}
}
