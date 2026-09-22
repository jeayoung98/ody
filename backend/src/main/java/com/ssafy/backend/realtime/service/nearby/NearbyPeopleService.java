package com.ssafy.backend.realtime.service.nearby;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.dto.nearby.NearbyPerson;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.service.nearby.NearbyMusicService.NearbyMusic;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.session.WebSocketSessionService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 주변사람 버튼을 눌렀을 때 목록을 만들고 실시간 변화를 구독하는 곳 (RT-10·11, T1·T2).
 * 순서: 내가 지금 듣는 곡 확인 → 비슷한 곡들 가져오기 → 구독 등록 → 곡마다 듣는 사람을 꺼내 목록에 담기.
 * 지도에 점으로 찍지 않고 목록만 준다(지도 점은 뷰포트가 따로 한다).
 * realtime 켰을 때만 뜬다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyPeopleService {

	private final PresenceRedisRepository presenceRepository;
	private final NearbyMusicService nearbyMusicService;
	private final NearbyRedisRepository nearbyRepository;
	private final UserDisplayService userDisplayService;
	private final MeetingService meetingService;
	private final RiderCountService riderCountService;
	private final WebSocketSessionService webSocketSessionService; // 현재 소켓 메시지 순번

	/**
	 * 지금 이 사람 기준으로 주변사람 목록 패널을 연다
	 *
	 * @param email 버튼 누른 사람(토큰에서 꺼낸 값)
	 * @return 내 곡과 비슷한 곡을 듣는 사람들을 가까운 순으로 담은 목록
	 */
	public NearbySnapshot open(String email) {
		// 1) 내가 지금 무슨 곡을 듣고 있는지 확인한다.
		//    아직 아무 곡도 안 틀었으면(기준 곡이 없으면) 목록을 만들 수 없어서 막는다.
		PresenceSnapshot me = presenceRepository.snapshot(email);
		if (me == null || me.musicId() == null) {
			log.warn("주변사람 목록 거부 reason={}", WebSocketErrorCode.PRESENCE_NO_ANCHOR);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		long myMusicId = me.musicId();

		// 2) BE2한테 "내 곡이랑 비슷한 곡들 찾아줘" 시킨다(내 곡도 맨 앞에, 가까운 순으로 옴).
		//    이게 준비 안됐거나 실패하면 에러코드
		List<NearbyMusic> songs;
		try {
			songs = nearbyMusicService.findCurrentAndNearbyMusic(myMusicId);
		} catch (CustomException e) {
			throw e; // 곡을 못 찾음 같은 건 그대로 올려보낸다
		} catch (RuntimeException e) {
			log.warn("주변사람 목록 - 비슷한 곡 찾기 실패 myMusicId={}", myMusicId, e);
			throw new CustomException(RealtimeErrorCode.SERVICE_UNAVAILABLE);
		}

		// 3) 목록 조회 중 생기는 변경도 받도록 구독을 먼저 바꾼다.
		List<Long> musicIds = songs.stream().map(NearbyMusic::musicId).toList();
		if (!nearbyRepository.replaceSubscriptions(email, me.epoch(), musicIds)) {
			log.warn("주변사람 목록 거부 reason={}", WebSocketErrorCode.PRESENCE_STALE);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		// 이 순번 이후의 실시간 변경만 목록에 반영한다.
		long snapshotSeq = webSocketSessionService.currentMessageSeq(email);

		// 4) 구독 등록이 끝난 뒤 그 곡들 각각을 지금 누가 듣고 있는지 읽어온다.
		Map<Long, Set<String>> listenersByMusic = nearbyRepository.listeners(musicIds);

		// 5) 곡마다 듣는 사람을 꺼내 사람 한 명씩 목록에 넣는다. 나 자신은 뺀다.
		//    곡이 가까운 순으로 와 있어서 이 순서대로 넣으면 목록도 자연히 가까운 순이 된다.
		// 따라오는 인원 수는 한 번에 읽는다. 한 명씩 읽으면 목록에 오르는 사람 수만큼 Redis 를 다녀와야 한다.
		Set<String> listenerEmails = new LinkedHashSet<>();
		for (NearbyMusic song : songs) {
			listenerEmails.addAll(listenersByMusic.getOrDefault(song.musicId(), Set.of()));
		}
		listenerEmails.remove(email);
		Map<String, Integer> riderCountByEmail = riderCountService.countAll(listenerEmails);

		List<NearbyPerson> people = new ArrayList<>();
		for (NearbyMusic song : songs) {
			Set<String> listeners = listenersByMusic.getOrDefault(song.musicId(), Set.of());
			for (String listener : listeners) {
				if (listener.equals(email)) {
					continue; // 나 자신은 목록에 안 넣는다
				}
				UserDisplay who = userDisplayService.find(listener);
				people.add(new NearbyPerson(
						listener, who.nickname(), who.imageUrl(),
						meetingService.countWith(email, listener),
						riderCountByEmail.getOrDefault(listener, 0),
						song.musicId(), song.title(), song.artist(), song.distance()));
			}
		}

		log.info("[Nearby] 주변사람 목록 완료 myMusicId={} 사람수={}", myMusicId, people.size());
		return new NearbySnapshot(myMusicId, snapshotSeq, people);
	}

	/**
	 *  패널을 연 접속 버전과 닫기 요청의 접속 버전이 같을 때만 구독을 닫는다.
	 *
	 * @param email 패널을 닫은 사용자 이메일
	 * @param epoch 패널을 연 접속 버전
	 */
	public void close(String email, long epoch) {
		boolean closed = nearbyRepository.closeSubscriptions(email, epoch);
		log.info("[Nearby] 주변사람 구독 종료 성공={}", closed);
	}
}
