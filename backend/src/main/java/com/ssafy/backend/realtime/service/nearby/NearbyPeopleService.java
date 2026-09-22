package com.ssafy.backend.realtime.service.nearby;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.dto.layer.LayerUsersSnapshot;
import com.ssafy.backend.realtime.dto.nearby.NearbyPerson;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.error.RealtimeErrorCode;
import com.ssafy.backend.realtime.error.WebSocketErrorCode;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.service.layer.LayerUsersService;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.session.WebSocketSessionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 주변사람 버튼을 눌렀을 때 목록을 만들고 실시간 변화를 구독하는 곳 (RT-10·11).
 *
 * 기준이 내 레이어 전체다 (S15P21A405-582). 예전에는 내 곡과 비슷한 곡 열 개를 듣는 사람만
 * 담았는데, 사람이 적을 때 목록이 거의 비어서 그 층에 있는 사람을 전부 담는 것으로 바꿨다.
 *
 * 순서: 내가 선 자리 확인 → 그 층 사람 전부 읽기 → 가까운 순으로 상한까지 자르기 → 만난 횟수 붙이기.
 *
 * 읽는 일은 {@link LayerUsersService} 가 한다. 지도가 그 층 사람을 그릴 때 쓰는 바로 그
 * 코드라, 따로 두면 같은 Redis 훑기가 두 번 돌고 "좌표 없는 곡은 건너뛴다" 같은 판단이
 * 두 곳에서 갈린다.
 *
 * 지도에 점으로 찍지 않고 목록만 준다(지도 점은 뷰포트가 따로 한다). realtime 켰을 때만 뜬다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyPeopleService {

	private final PresenceRedisRepository presenceRepository;
	private final LayerUsersService layerUsersService; // 그 층 사람 전부 — 지도와 같은 코드
	private final MusicLocationService musicLocationService; // 내가 선 곡의 좌표
	private final MusicPositionCalculator musicPositionCalculator; // 레이어별 표시축
	private final NearbyRedisRepository nearbyRepository;
	private final MeetingService meetingService;
	private final WebSocketSessionService webSocketSessionService; // 현재 소켓 메시지 순번
	private final RealtimeProperties realtimeProperties; // 패널 인원 상한

	/**
	 * 지금 이 사람 기준으로 주변사람 목록 패널을 연다.
	 *
	 * @param email 버튼 누른 사람(토큰에서 꺼낸 값)
	 * @return 내가 있는 층의 사람들을 가까운 순으로 담은 목록
	 */
	public NearbySnapshot open(String email) {
		// 1) 내가 어느 층 어느 곡에 서 있는지 확인한다.
		//    아직 아무 곡도 안 틀었으면 층도 자리도 없어서 목록을 만들 수 없다.
		PresenceSnapshot me = presenceRepository.snapshot(email);
		if (me == null || me.musicId() == null || me.layer() == null) {
			log.warn("주변사람 목록 거부 reason={}", WebSocketErrorCode.PRESENCE_NO_ANCHOR);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		long myMusicId = me.musicId();
		int layer = me.layer();

		// 2) 그 층 사람 전부를 곡 위치별로 읽는다. 지도가 쓰는 코드와 같은 것이다.
		LayerUsersSnapshot onThisLayer = layerUsersService.findAll(layer, email);

		// 3) 목록을 만드는 사이에 생기는 변경도 받도록 구독을 먼저 바꾼다.
		//    지금은 곡별 구독이라 이 층에서 지금 재생 중인 곡들을 그대로 넘긴다.
		List<Long> musicIds = onThisLayer.groups().stream().map(ViewportMusicGroup::musicId).toList();
		if (!nearbyRepository.replaceSubscriptions(email, me.epoch(), musicIds)) {
			log.warn("주변사람 목록 거부 reason={}", WebSocketErrorCode.PRESENCE_STALE);
			throw new CustomException(RealtimeErrorCode.PRESENCE_ERROR);
		}
		// 이 순번 이후의 실시간 변경만 목록에 반영한다.
		long snapshotSeq = webSocketSessionService.currentMessageSeq(email);

		// 4) 내 자리를 구한다. 거리를 재는 기준점이다.
		double[] mySpot = spotOf(myMusicId, layer);

		// 5) 곡 묶음을 사람 한 명씩으로 펴면서 내 자리에서의 거리를 같이 구한다.
		List<NearbyPerson> people = new ArrayList<>();
		for (ViewportMusicGroup group : onThisLayer.groups()) {
			double distance = mySpot == null
					? 0.0
					: Math.hypot(group.x() - mySpot[0], group.y() - mySpot[1]);
			for (ViewportUser user : group.users()) {
				people.add(new NearbyPerson(
						user.email(), user.nickname(), user.imageUrl(),
						0, user.riderCount(),
						group.musicId(), group.x(), group.y(), distance));
			}
		}

		// 6) 가까운 순으로 자른다. 만난 횟수를 붙이기 전에 자르는 것이 중요하다 —
		//    그 조회는 사람마다 한 번씩 도는 자리라, 화면에 안 나갈 사람까지 세면 그만큼 낭비다.
		int cap = realtimeProperties.nearby().panelCap();
		people.sort(Comparator.comparingDouble(NearbyPerson::distance));
		if (people.size() > cap) {
			people = new ArrayList<>(people.subList(0, cap));
		}

		// 7) 만난 횟수를 붙인다. 받는 사람마다 다른 값이라 사람별로 구한다.
		people.replaceAll(p -> new NearbyPerson(
				p.email(), p.nickname(), p.imageUrl(),
				meetingService.countWith(email, p.email()), p.riderCount(),
				p.musicId(), p.x(), p.y(), p.distance()));

		log.info("[Nearby] 주변사람 목록 완료 layer={} myMusicId={} 사람수={}", layer, myMusicId, people.size());
		return new NearbySnapshot(myMusicId, snapshotSeq, people);
	}

	/**
	 * 내가 선 곡의 그 레이어 표시 좌표.
	 *
	 * 좌표를 못 찾으면 null 이다. 목록을 막지는 않는다 — 그 층에 누가 있는지는 여전히 뜻이 있고,
	 * 거리만 0 이 되어 정렬이 임의 순서가 된다.
	 */
	private double[] spotOf(long musicId, int layer) {
		try {
			int[] axes = musicPositionCalculator.findAxes(layer);
			return musicLocationService.findLocation(musicId)
					.filter(pc -> pc.length >= axes[1])
					.map(pc -> new double[] {pc[axes[0] - 1], pc[axes[1] - 1]})
					.orElse(null);
		} catch (IllegalArgumentException e) {
			log.warn("[Nearby] 내 자리를 못 구했다 layer={} musicId={}", layer, musicId);
			return null;
		}
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
