package com.ssafy.backend.realtime.service.nearby;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.service.meeting.MeetingService;
import com.ssafy.backend.realtime.dto.nearby.NearbyBulkEnter;
import com.ssafy.backend.realtime.dto.nearby.NearbyChange;
import com.ssafy.backend.realtime.dto.nearby.NearbyRiderCount;
import com.ssafy.backend.realtime.dto.nearby.NearbySnapshot;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;

/** 곡 변경을 주변사람 ENTER·MOVE·LEAVE로 나눠 개인 큐에 보낸다. */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyChangeService {


	private final NearbyRedisRepository nearbyRepository; // 곡별 주변사람 구독자
	private final UserDisplayService userDisplayService; // 닉네임과 사진
	private final RealtimeMessageService realtimeMessageService; // 개인 큐로 메시지 전송
	private final RealtimeEventService realtimeEventService; // 곡 변경 알림
	private final MeetingService meetingService; // 두 사용자 만난 횟수
	private final RiderCountService riderCountService; // 따라오는 사용자 수
	private final NearbyPeopleService nearbyPeopleService; // 본인 구독과 목록 다시 만들기
	private final MusicLocationService musicLocationService; // 알림에 실을 곡 자리
	private final MusicPositionCalculator musicPositionCalculator; // 층별 표시축

	/**
	 * 서비스가 시작되면 곡 변경 알림을 구독한다.
	 */
	@PostConstruct
	void subscribeToChanges() {
		realtimeEventService.listen(this::handlePositionChanged);
	}

	/**
	 * 주변사람 : 자리 변경을 ENTER·MOVE·LEAVE 로 나눠 전달한다.
	 *
	 * 기준이 층이라 판정이 집합 연산에서 층 비교로 바뀌었다 (S15P21A405-582).
	 * 한 사람은 층 하나만 구독하므로, 층이 다르면 두 구독자 집합은 서로 겹치지 않는다 —
	 * 옛 층 사람에게는 LEAVE 만, 새 층 사람에게는 ENTER 만 간다.
	 *
	 * @param event 자리를 옮긴 사용자와 이전·현재 층·곡
	 */
	void handlePositionChanged(PositionChanged event) {
		boolean sameLayer = Objects.equals(event.oldLayer(), event.newLayer());

		// 층도 곡도 그대로면 목록에서 바뀔 것이 없다.
		if (sameLayer && Objects.equals(event.oldMusicId(), event.newMusicId())) {
			return;
		}

		if (sameLayer) {
			// 같은 층에서 곡만 바꿨다. 목록에 그대로 있고 자리만 옮긴다.
			sendToLayer(event, event.newLayer(), RealtimeMessageType.NEARBY_MOVE);
		} else {
			// 층을 옮겼다. 떠난 층에서는 사라지고 닿은 층에서는 나타난다.
			Set<String> left = new LinkedHashSet<>(subscribers(event.oldLayer()));
			left.remove(event.email());
			sendLeave(left, event.email());
			sendToLayer(event, event.newLayer(), RealtimeMessageType.NEARBY_ENTER);
		}

		refreshOwnPanel(event, sameLayer);
	}

	/**
	 * 그 층을 보고 있는 사람들에게 지금 모습을 보낸다.
	 *
	 * 자리는 한 번만 구해 전원이 나눠 쓴다. 곡이 같으면 자리도 같기 때문이다.
	 * 거리는 싣지 않는다 — 받는 사람마다 다른 값이라, 여기서 구하려면 사람 수만큼 조회가 돈다.
	 * 받는 쪽은 자기 자리를 알고 있으므로 좌표만 있으면 스스로 잰다.
	 */
	private void sendToLayer(PositionChanged event, Integer layer, RealtimeMessageType type) {
		if (layer == null || event.newMusicId() == null) {
			return; // 닿은 곳이 없다. 퇴장은 위에서 LEAVE 로 이미 알렸다
		}
		Set<String> receivers = new LinkedHashSet<>(subscribers(layer));
		receivers.remove(event.email()); // 목록은 본인을 보여주지 않는다
		if (receivers.isEmpty()) {
			return;
		}

		UserDisplay who = userDisplayService.find(event.email());
		int riderCount = riderCountService.count(event.email());
		double[] spot = spotOf(event.newMusicId(), layer);
		sendCurrent(receivers, event.email(), who, riderCount, type, event.newMusicId(), spot);
	}

	/**
	 * 그 곡의 층 표시 좌표. 못 구하면 null 이고, 그때는 자리 없이 알린다 —
	 * 누가 들어왔는지는 여전히 알려야 한다.
	 */
	private double[] spotOf(long musicId, int layer) {
		try {
			int[] axes = musicPositionCalculator.findAxes(layer);
			return musicLocationService.findLocation(musicId)
					.filter(pc -> pc.length >= axes[1])
					.map(pc -> new double[] {pc[axes[0] - 1], pc[axes[1] - 1]})
					.orElse(null);
		} catch (IllegalArgumentException e) {
			return null;
		}
	}

	/**
	 * 한 사람의 따라오는 인원수가 바뀌었다고 그 곡을 보고 있는 사람들에게 알린다.
	 *
	 * 곡도 자리도 그대로라 목록에서 옮길 것은 없다. 숫자만 바꾸면 된다.
	 *
	 * @param email 인원수가 바뀐 사람
	 * @param musicId 그 사람이 있는 곡
	 * @param riderCount 바뀐 뒤의 인원수
	 */
	public void sendRiderCount(String email, int layer, long musicId, int riderCount) {
		Set<String> receivers = new LinkedHashSet<>(nearbyRepository.subscribers(layer));
		receivers.remove(email);
		if (receivers.isEmpty()) {
			return;
		}
		NearbyRiderCount payload = new NearbyRiderCount(email, riderCount, musicId);
		for (String receiver : receivers) {
			realtimeMessageService.sendToUser(receiver, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.NEARBY_RIDER_COUNT, payload);
		}
	}

	/**
	 * 한 곡에 여러 사람이 한꺼번에 나타났다고 알린다.
	 *
	 * 선단이 흩어질 때 쓴다. 해체는 위치 변경 알림을 거치지 않고 지도 인덱스를 직접 바꾸기 때문에,
	 * 주변사람 목록은 그대로 두면 아무것도 모른다. 패널을 다시 열면 보이는데 열어 둔 채로는
	 * 안 보여서, 목록과 실제가 어긋난 채 남는다.
	 *
	 * 한 명씩 알리면 사람 수만큼 알림이 나가므로 받는 사람마다 한 덩어리로 보낸다.
	 * 만난 횟수는 받는 사람마다 달라서 덩어리도 받는 사람마다 따로 만든다.
	 *
	 * @param emails 나타난 사람들
	 * @param musicId 나타난 곡
	 */
	public void sendEnteredTogether(List<String> emails, int layer, long musicId) {
		if (emails == null || emails.isEmpty()) {
			return;
		}
		Set<String> receivers = new LinkedHashSet<>(nearbyRepository.subscribers(layer));
		receivers.removeAll(emails);
		if (receivers.isEmpty()) {
			return;
		}

		// 닉네임과 따라오는 인원수는 받는 사람과 무관하다. 한 번만 읽는다.
		Map<String, UserDisplay> displayByEmail = new LinkedHashMap<>();
		emails.forEach(email -> displayByEmail.computeIfAbsent(email, userDisplayService::find));
		Map<String, Integer> riderCounts = riderCountService.countAll(emails);
		// 한 곡에 같이 나타난 사람들이라 자리도 하나다. 한 번만 구해 전원이 나눠 쓴다.
		double[] spot = spotOf(musicId, layer);
		Double x = spot == null ? null : spot[0];
		Double y = spot == null ? null : spot[1];

		for (String receiver : receivers) {
			List<NearbyChange> people = emails.stream()
					.map(email -> {
						UserDisplay who = displayByEmail.get(email);
						return new NearbyChange(email, who.nickname(), who.imageUrl(),
								meetingService.countWith(receiver, email),
								riderCounts.getOrDefault(email, 0), musicId, x, y);
					})
					.toList();
			realtimeMessageService.sendToUser(receiver, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.NEARBY_BULK_ENTER, new NearbyBulkEnter(musicId, people));
		}
	}

	/**
	 * 본인이 층을 옮기면 구독과 목록을 다시 만든다.
	 *
	 * 같은 층에서 곡만 바꿀 때는 하지 않는다 (S15P21A405-582). 기준이 층이라 목록에 담길
	 * 사람이 그대로이기 때문이다. 바뀌는 것은 내 자리에서 잰 거리뿐이고, 받는 쪽은 자기가
	 * 어디로 옮겼는지 알고 있으므로 스스로 다시 잰다.
	 *
	 * 예전에는 곡을 바꿀 때마다 기준곡이 달라져 목록을 통째로 다시 만들었다.
	 *
	 * @param event 본인의 자리 변경 정보
	 * @param sameLayer 층이 그대로인지
	 */
	private void refreshOwnPanel(PositionChanged event, boolean sameLayer) {
		if (sameLayer || event.newMusicId() == null || !nearbyRepository.hasSubscription(event.email())) {
			return;
		}

		NearbySnapshot snapshot = nearbyPeopleService.open(event.email()); //구독 재구성 및 목록 생성
		realtimeMessageService.sendToUser(event.email(), WebSocketDestination.QUEUE_PRESENCE,
				RealtimeMessageType.NEARBY_SNAPSHOT, snapshot);
	}

	/**
	 * 이 곡의 변화를 보고 있는 사용자를 찾는다.
	 * @param musicId 조회할 곡 ID
	 * @return 곡 변화를 구독한 사용자들
	 */
	private Set<String> subscribers(Integer layer) {
		return layer == null ? Set.of() : nearbyRepository.subscribers(layer);
	}

	/**
	 * LEAVE 수신자에게 목록에서 지울 이메일만 보낸다.
	 *
	 * @param receivers 받을 사용자들
	 * @param actorEmail 목록에서 지울 사용자 이메일
	 */
	private void sendLeave(Set<String> receivers, String actorEmail) {
		NearbyChange payload = new NearbyChange(actorEmail, null, null, null, null, null, null, null);
		for (String receiver : receivers) {
			realtimeMessageService.sendToUser(receiver, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.NEARBY_LEAVE, payload);
		}
	}

	/**
	 * ENTER·MOVE 수신자에게 현재 사용자 정보를 보낸다.
	 *
	 * @param receivers 받을 사용자들
	 * @param actorEmail 곡을 바꾼 사용자 이메일
	 * @param who 곡을 바꾼 사용자의 화면 정보
	 * @param riderCount 곡을 바꾼 사용자의 동승자 수
	 * @param type 전달할 변경 종류
	 * @param musicId 현재 곡 ID
	 */
	private void sendCurrent(Set<String> receivers, String actorEmail, UserDisplay who, int riderCount,
			RealtimeMessageType type, Long musicId, double[] spot) {
		Double x = spot == null ? null : spot[0];
		Double y = spot == null ? null : spot[1];
		for (String receiver : receivers) {
			NearbyChange payload = new NearbyChange(
					actorEmail, who.nickname(), who.imageUrl(),
					meetingService.countWith(receiver, actorEmail), riderCount,
					musicId, x, y);
			realtimeMessageService.sendToUser(receiver, WebSocketDestination.QUEUE_PRESENCE, type, payload);
		}
	}
}
