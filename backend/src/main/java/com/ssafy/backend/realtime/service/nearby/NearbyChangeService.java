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
import com.ssafy.backend.realtime.repository.redis.NearbyRedisRepository;
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

	/**
	 * 서비스가 시작되면 곡 변경 알림을 구독한다.
	 */
	@PostConstruct
	void subscribeToChanges() {
		realtimeEventService.listen(this::handlePositionChanged);
	}

	/**
	 * 주변사람 : 곡 변경을 ENTER·MOVE·LEAVE로 나눠 전달한다.
	 * @param event 곡을 바꾼 사용자와 이전·현재 곡
	 */
	void handlePositionChanged(PositionChanged event) {
		// 곡이 같으면 주변사람 목록은 바뀌지 않는다.
		if (Objects.equals(event.oldMusicId(), event.newMusicId())) {
			return;
		}

		// 이전·현재 곡 구독자를 비교해야 LEAVE·ENTER·MOVE 수신자를 나눌 수 있다.
		Set<String> oldSubscribers = subscribers(event.oldMusicId());
		Set<String> newSubscribers = subscribers(event.newMusicId());

		Set<String> leaveReceivers = findLeaveReceivers(oldSubscribers, newSubscribers); // 목록에서 뺄 사람
		Set<String> enterReceivers = findEnterReceivers(oldSubscribers, newSubscribers); // 목록에 넣을 사람
		Set<String> moveReceivers = findMoveReceivers(oldSubscribers, newSubscribers);   // 현재 곡을 바꿀 사람

		// 주변사람 목록은 본인을 보여주지 않는다.
		leaveReceivers.remove(event.email());
		enterReceivers.remove(event.email());
		moveReceivers.remove(event.email());

		// 받을 사람이 있을 때만 변경 알림을 보낸다.
		if (!leaveReceivers.isEmpty() || !enterReceivers.isEmpty() || !moveReceivers.isEmpty()) {
			// LEAVE는 목록에서 지울 이메일만 보낸다.
			sendLeave(leaveReceivers, event.email());

			// ENTER·MOVE는 목록에 보여줄 정보까지 보낸다.
			if (!enterReceivers.isEmpty() || !moveReceivers.isEmpty()) {
				UserDisplay who = userDisplayService.find(event.email());
				int riderCount = riderCountService.count(event.email());
				sendCurrent(enterReceivers, event.email(), who, riderCount,
						RealtimeMessageType.NEARBY_ENTER, event.newMusicId());
				sendCurrent(moveReceivers, event.email(), who, riderCount,
						RealtimeMessageType.NEARBY_MOVE, event.newMusicId());
			}
		}

		refreshOwnPanel(event);
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
	public void sendRiderCount(String email, long musicId, int riderCount) {
		Set<String> receivers = new LinkedHashSet<>(nearbyRepository.subscribers(musicId));
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
	public void sendEnteredTogether(List<String> emails, long musicId) {
		if (emails == null || emails.isEmpty()) {
			return;
		}
		Set<String> receivers = new LinkedHashSet<>(nearbyRepository.subscribers(musicId));
		receivers.removeAll(emails);
		if (receivers.isEmpty()) {
			return;
		}

		// 닉네임과 따라오는 인원수는 받는 사람과 무관하다. 한 번만 읽는다.
		Map<String, UserDisplay> displayByEmail = new LinkedHashMap<>();
		emails.forEach(email -> displayByEmail.computeIfAbsent(email, userDisplayService::find));
		Map<String, Integer> riderCounts = riderCountService.countAll(emails);

		for (String receiver : receivers) {
			List<NearbyChange> people = emails.stream()
					.map(email -> {
						UserDisplay who = displayByEmail.get(email);
						return new NearbyChange(email, who.nickname(), who.imageUrl(),
								meetingService.countWith(receiver, email),
								riderCounts.getOrDefault(email, 0), musicId);
					})
					.toList();
			realtimeMessageService.sendToUser(receiver, WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.NEARBY_BULK_ENTER, new NearbyBulkEnter(musicId, people));
		}
	}

	/**
	 * 주변사람 조회 패널이 열린 상태로 본인의 곡이 바뀌면 구독과 목록을 다시 만든다.
	 * @param event 본인의 곡 변경 정보
	 */
	private void refreshOwnPanel(PositionChanged event) {
		if (event.newMusicId() == null || !nearbyRepository.hasSubscription(event.email())) { // 패널이 열렸는지 확인
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
	private Set<String> subscribers(Long musicId) {
		return musicId == null ? Set.of() : nearbyRepository.subscribers(musicId);
	}

	/**
	 * 이전 곡만 구독한 LEAVE 수신자를 찾는다.
	 *
	 * @param oldSubscribers 이전 곡 구독자
	 * @param newSubscribers 현재 곡 구독자
	 * @return 목록에서 사용자를 뺄 수신자들
	 */
	private Set<String> findLeaveReceivers(Set<String> oldSubscribers, Set<String> newSubscribers) {
		Set<String> result = new LinkedHashSet<>(oldSubscribers);
		result.removeAll(newSubscribers);
		return result;
	}

	/**
	 * 현재 곡만 구독한 ENTER 수신자를 찾는다.
	 *
	 * @param oldSubscribers 이전 곡 구독자
	 * @param newSubscribers 현재 곡 구독자
	 * @return 목록에 사용자를 넣을 수신자들
	 */
	private Set<String> findEnterReceivers(Set<String> oldSubscribers, Set<String> newSubscribers) {
		Set<String> result = new LinkedHashSet<>(newSubscribers);
		result.removeAll(oldSubscribers);
		return result;
	}

	/**
	 * 이전·현재 곡을 모두 구독한 MOVE 수신자를 찾는다.
	 *
	 * @param oldSubscribers 이전 곡 구독자
	 * @param newSubscribers 현재 곡 구독자
	 * @return 목록에서 현재 곡을 바꿀 수신자들
	 */
	private Set<String> findMoveReceivers(Set<String> oldSubscribers, Set<String> newSubscribers) {
		Set<String> result = new LinkedHashSet<>(oldSubscribers);
		result.retainAll(newSubscribers);
		return result;
	}

	/**
	 * LEAVE 수신자에게 목록에서 지울 이메일만 보낸다.
	 *
	 * @param receivers 받을 사용자들
	 * @param actorEmail 목록에서 지울 사용자 이메일
	 */
	private void sendLeave(Set<String> receivers, String actorEmail) {
		NearbyChange payload = new NearbyChange(actorEmail, null, null, null, null, null);
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
			RealtimeMessageType type, Long musicId) {
		for (String receiver : receivers) {
			NearbyChange payload = new NearbyChange(
					actorEmail, who.nickname(), who.imageUrl(),
					meetingService.countWith(receiver, actorEmail), riderCount,
					musicId);
			realtimeMessageService.sendToUser(receiver, WebSocketDestination.QUEUE_PRESENCE, type, payload);
		}
	}
}
