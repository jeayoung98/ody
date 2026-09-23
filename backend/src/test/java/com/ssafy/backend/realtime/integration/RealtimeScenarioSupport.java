package com.ssafy.backend.realtime.integration;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.repository.mapper.MeetingMapper;
import com.ssafy.backend.realtime.repository.mapper.PlayHistoryMapper;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.play.MusicPlayService;
import com.ssafy.backend.realtime.service.presence.PresenceService;
import com.ssafy.backend.realtime.service.ride.RideService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

/**
 * 실시간 시나리오 시험이 공통으로 쓰는 준비와 뒷정리.
 *
 * 바깥 세계만 가짜로 둔다 — DB(재생 기록·만남), 곡 좌표, 사용자 표시, 내보내는 메시지 넷이다.
 * Redis·Lua·서비스는 전부 실물이라 키가 실제로 어떻게 남는지 그대로 확인할 수 있다.
 *
 * 계정 이름에 임의의 값을 붙이고, 시험이 끝나면 그 계정이 건드린 키를 전부 지운다.
 * 시험끼리 서로의 데이터를 보지 않게 하기 위해서다.
 */
abstract class RealtimeScenarioSupport {

	protected static final int LAYER = 0;
	protected static final int OTHER_LAYER = 1;

	/** 곡 좌표는 두 축에 같은 값을 넣는다. 값이 다르면 지도에서 다른 자리에 놓인다. */
	protected static final long SONG_A = 9101L;
	protected static final long SONG_B = 9102L;
	protected static final long SONG_C = 9103L;

	/** 곡이 지도 어디에 있는지. 1번과 2번은 가깝고 3번은 멀리 떨어져 있다. */
	private static final Map<Long, double[]> LOCATIONS = Map.of(
			SONG_A, at(1.0),
			SONG_B, at(5.0),
			SONG_C, at(-6.0));

	@Autowired protected StringRedisTemplate redis;
	@Autowired protected PresenceService presenceService;
	@Autowired protected MusicPlayService musicPlayService;
	@Autowired protected RideService rideService;
	@Autowired protected PresenceRedisRepository presenceRepository;
	@Autowired protected RideRedisRepository rideRepository;

	@MockitoBean protected PlayHistoryMapper playHistoryMapper;
	@MockitoBean protected MeetingMapper meetingMapper;
	@MockitoBean protected MusicLocationService musicLocationService;
	@MockitoBean protected UserDisplayService userDisplayService;
	@MockitoBean protected RealtimeMessageService realtimeMessageService;

	private final Set<String> emails = new LinkedHashSet<>();
	private final Map<String, Long> lastPlayed = new HashMap<>();
	private long nextId = 7000L;

	@BeforeEach
	void prepareOutsideWorld() {
		lenient().when(musicLocationService.exists(anyLong())).thenReturn(true);
		lenient().when(musicLocationService.playable(anyLong())).thenReturn(true);
		lenient().when(musicLocationService.findLocation(anyLong())).thenAnswer(
				call -> Optional.ofNullable(LOCATIONS.get((Long) call.getArgument(0))));
		lenient().when(musicLocationService.findLocations(anyList())).thenAnswer(call -> {
			Map<Long, double[]> found = new HashMap<>();
			for (Long musicId : (List<Long>) call.getArgument(0)) {
				double[] location = LOCATIONS.get(musicId);
				if (location != null) {
					found.put(musicId, location);
				}
			}
			return found;
		});
		lenient().when(userDisplayService.find(anyString()))
				.thenAnswer(call -> new UserDisplay(call.getArgument(0), null));
		// 새 탭으로 다시 들어올 때 서버가 확인하는 마지막 재생 기록이다.
		lenient().when(playHistoryMapper.findLatestMusicId(anyString()))
				.thenAnswer(call -> lastPlayed.get((String) call.getArgument(0)));
		lenient().when(playHistoryMapper.nextIds(anyInt())).thenAnswer(call -> {
			List<Long> ids = new ArrayList<>();
			for (int i = 0; i < (int) call.getArgument(0); i++) {
				ids.add(nextId++);
			}
			return ids;
		});
	}

	@AfterEach
	void wipeWhatThisTestTouched() {
		Set<String> keys = new LinkedHashSet<>();
		for (String email : emails) {
			keys.add("presence:user:" + email);
			keys.add("ride:captain:" + email);
			keys.add("ride:riders:" + email);
			keys.add("ride:playback:" + email);
			keys.add("ride:panel:" + email);
			keys.add("viewport:meta:" + email);
			keys.add("nearby:meta:" + email);
			redis.opsForZSet().remove("presence:expiry", email);
		}
		for (long musicId : List.of(SONG_A, SONG_B, SONG_C)) {
			keys.add("listeners:" + musicId);
			for (int layer : List.of(LAYER, OTHER_LAYER)) {
				keys.add("layer-listeners:" + layer + ":" + musicId);
			}
		}
		for (int layer : List.of(LAYER, OTHER_LAYER)) {
			keys.add("active-song:cells:" + layer);
			keys.add("cell:usercount:" + layer);
			keys.add("viewport:clustered:" + layer);
			keys.add("nearby:layer-subscribers:" + layer);
			keys.addAll(redis.keys("active-song:cell:" + layer + ":*"));
			keys.addAll(redis.keys("viewport:cell:" + layer + ":*"));
		}
		keys.addAll(redis.keys("meeting-cd:*"));
		redis.delete(keys);
		emails.clear();
		lastPlayed.clear();
	}

	/** 접속만 한다. 곡 위에 서지 않아 남의 화면에는 보이지 않는다. */
	protected String watcher() {
		String email = newEmail();
		presenceService.connect(email, 1L);
		return email;
	}

	/** 접속하고 곡 위에 선다. */
	protected String stand(long musicId) {
		String email = newEmail();
		presenceService.connect(email, 1L);
		musicPlayService.play(email, musicId, "MAP", LAYER);
		lastPlayed.put(email, musicId);
		return email;
	}

	/** 이미 서 있는 사람을 다른 곡으로 옮긴다. */
	protected void moveTo(String email, long musicId) {
		musicPlayService.play(email, musicId, "MAP", LAYER);
		lastPlayed.put(email, musicId);
	}

	private String newEmail() {
		String email = "scenario-it-" + UUID.randomUUID() + "@test.local";
		emails.add(email);
		return email;
	}

	/** 두 축만 채운 16차원 좌표. 값이 다르면 다른 셀에 놓인다. */
	protected static double[] at(double value) {
		double[] pc = new double[16];
		pc[0] = value;
		pc[1] = value;
		return pc;
	}

	protected String cellOf(String email) {
		PresenceSnapshot snapshot = presenceRepository.snapshot(email);
		return snapshot.cellX() + ":" + snapshot.cellY();
	}

	protected int cellCount(int layer, String cell) {
		Object value = redis.opsForHash().get("cell:usercount:" + layer, cell);
		return value == null ? 0 : Integer.parseInt(value.toString());
	}
}
