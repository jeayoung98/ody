package com.ssafy.backend.realtime.nearby.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.common.RealtimeErrorCode;
import com.ssafy.backend.realtime.common.RealtimeErrorCode.WsCode;
import com.ssafy.backend.realtime.common.UserDisplayResolver;
import com.ssafy.backend.realtime.nearby.dto.NearbyPerson;
import com.ssafy.backend.realtime.nearby.dto.NearbySnapshot;
import com.ssafy.backend.realtime.nearby.port.NeighborPort;
import com.ssafy.backend.realtime.nearby.port.NeighborPort.NeighborSong;
import com.ssafy.backend.realtime.nearby.repository.NearbyRedisRepository;
import com.ssafy.backend.realtime.presence.dto.UserView;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository;
import com.ssafy.backend.realtime.presence.repository.PresenceRedisRepository.PresenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 주변사람 버튼을 눌렀을 때 목록을 만들어 주는 곳 (RT-10, T1).
 * 순서: 내가 지금 듣는 곡 확인 → 비슷한 곡들 가져오기 → 곡마다 듣는 사람을 꺼내 사람 한 명씩 목록에 담기.
 * 지도에 점으로 찍지 않고 목록만 준다(지도 점은 뷰포트가 따로 한다). 실시간 변화는 T2에서.
 * realtime 켰을 때만 뜬다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyPeopleService {

	private final PresenceRedisRepository presenceRepo;
	private final NeighborPort neighborPort;
	private final NearbyRedisRepository nearbyRepo;
	private final UserDisplayResolver userDisplayResolver;

	/**
	 * 지금 이 사람 기준으로 주변사람 목록을 만든다.
	 *
	 * @param email 버튼 누른 사람(토큰에서 꺼낸 값)
	 * @return 내 곡과 비슷한 곡을 듣는 사람들을 가까운 순으로 담은 목록
	 */
	public NearbySnapshot open(String email) {
		// 1) 내가 지금 무슨 곡을 듣고 있는지 확인한다.
		//    아직 아무 곡도 안 틀었으면(기준 곡이 없으면) 목록을 만들 수 없어서 막는다.
		PresenceSnapshot me = presenceRepo.snapshot(email);
		if (me == null || me.musicId() == null) {
			log.warn("주변사람 목록 거부 reason={}", WsCode.PRESENCE_NO_ANCHOR);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		long myMusicId = me.musicId();

		// 2) BE2한테 "내 곡이랑 비슷한 곡들 찾아줘" 시킨다(내 곡도 맨 앞에, 가까운 순으로 옴).
		//    이게 준비 안됐거나 실패하면 에러코드
		List<NeighborSong> songs;
		try {
			songs = neighborPort.anchorAndNeighbors(myMusicId);
		} catch (CustomException e) {
			throw e; // 곡을 못 찾음 같은 건 그대로 올려보낸다
		} catch (RuntimeException e) {
			log.warn("주변사람 목록 - 비슷한 곡 찾기 실패 myMusicId={}", myMusicId, e);
			throw new CustomException(RealtimeErrorCode.SERVICE_UNAVAILABLE);
		}

		// 3) 그 곡들 각각을 지금 누가 듣고 있는지 한 번에 읽어온다.
		List<Long> musicIds = songs.stream().map(NeighborSong::musicId).toList();
		Map<Long, Set<String>> listenersByMusic = nearbyRepo.listeners(musicIds);

		// 4) 곡마다 듣는 사람을 꺼내 사람 한 명씩 목록에 넣는다. 나 자신은 뺀다.
		//    곡이 가까운 순으로 와 있어서 이 순서대로 넣으면 목록도 자연히 가까운 순이 된다.
		List<NearbyPerson> people = new ArrayList<>();
		for (NeighborSong song : songs) {
			Set<String> listeners = listenersByMusic.getOrDefault(song.musicId(), Set.of());
			for (String listener : listeners) {
				if (listener.equals(email)) {
					continue; // 나 자신은 목록에 안 넣는다
				}
				UserView who = userDisplayResolver.resolve(listener);
				people.add(new NearbyPerson(
						who.nickname(), who.imageUrl(),
						song.musicId(), song.title(), song.artist(), song.distance()));
			}
		}

		log.info("[Nearby] 주변사람 목록 완료 myMusicId={} 사람수={}", myMusicId, people.size());
		return new NearbySnapshot(myMusicId, people);
	}
}
