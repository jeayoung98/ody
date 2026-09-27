package com.ssafy.backend.realtime.service.viewport;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.viewport.ViewportBulkEnter;
import com.ssafy.backend.realtime.dto.viewport.ViewportDelta;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.dto.viewport.ViewportRiderCount;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.event.PositionChanged;
import com.ssafy.backend.realtime.event.RealtimeEventService;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.message.RealtimeMessageService;
import com.ssafy.backend.realtime.message.RealtimeMessageType;
import com.ssafy.backend.realtime.message.WebSocketDestination;
import com.ssafy.backend.realtime.observability.ViewportMetrics;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ViewportMeta;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.ride.RideViewportService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;

/** 위치 변경을 화면별 ENTER·MOVE·LEAVE로 나눠 보낸다. */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class ViewportDeltaService {

	private final ViewportRedisRepository viewportRepository; // 셀을 지켜보는 사용자와 화면 정보
	private final MusicLocationService musicLocationService; // 곡의 실제 좌표
	private final MusicPositionCalculator musicPositionCalculator; // 화면에 표시할 위치
	private final UserDisplayService userDisplayService; // 닉네임과 사진
	private final RiderCountService riderCountService; // 따라오는 사용자 수
	private final RideViewportService rideViewportService; // 따라오는 사람에게 같은 알림 전달
	private final RealtimeMessageService realtimeMessageService; // 개인 큐 발송
	private final RealtimeEventService realtimeEventService; // 위치 변경 알림
	private final ViewportMetrics viewportMetrics; // 수신자 수와 발송 시간 기록

	/**
	 * 서비스가 시작되면 위치 변경 알림을 받는다.
	 */
	@PostConstruct
	void subscribeToChanges() {
		realtimeEventService.listen(this::handlePositionChanged);
	}

	/**
	 * 위치 변경을 각 사용자의 현재 화면에 맞는 알림으로 바꾼다.
	 *
	 * @param event 바뀌기 전 위치와 바뀐 후 위치
	 */
	void handlePositionChanged(PositionChanged event) {
		long startedAt = System.nanoTime();
		// 1. 이전 셀이나 새 셀을 보고 있는 사용자를 찾는다.
		Set<String> receivers = new LinkedHashSet<>(viewportRepository.findUsersWatchingCells(
				event.oldLayer(), event.oldCell(), event.newLayer(), event.newCell()));
		receivers.remove(event.email());
		int candidateCount = receivers.size();
		if (receivers.isEmpty()) {
			recordDelta(startedAt, candidateCount, 0, 0);
			return;
		}

		// 2. 개별 사용자 방식인 화면만 남긴다.
		Map<String, ViewportMeta> metas = new LinkedHashMap<>(
				viewportRepository.findMetaByEmails(receivers));
		metas.entrySet().removeIf(entry -> entry.getValue().mode() != ViewportMode.INDIVIDUAL);
		if (metas.isEmpty()) {
			recordDelta(startedAt, candidateCount, 0, 0);
			return;
		}
		int receiverCount = metas.size();

		// 3. 이전 곡과 새 곡의 실제 좌표를 한 번에 읽는다.
		Map<Long, double[]> locations = findLocations(event);
		double[] oldLocation = event.oldMusicId() == null ? null : locations.get(event.oldMusicId());
		double[] newLocation = event.newMusicId() == null ? null : locations.get(event.newMusicId());

		// 4. 각 화면에서 이전·새 위치가 보이는지 확인해 알림 종류를 정한다.
		Map<String, RealtimeMessageType> types = new LinkedHashMap<>();
		for (Map.Entry<String, ViewportMeta> entry : metas.entrySet()) {
			ViewportMeta meta = entry.getValue();
			boolean sawOld = isVisible(meta, event.oldLayer(), oldLocation)
					|| oldLocation == null && watchesCell(meta, event.oldLayer(), event.oldCell());
			boolean seesNew = isVisible(meta, event.newLayer(), newLocation);
			RealtimeMessageType type = changeType(sawOld, seesNew);
			if (type != null) {
				types.put(entry.getKey(), type);
			}
		}
		if (types.isEmpty()) {
			recordDelta(startedAt, candidateCount, receiverCount, 0);
			return;
		}

		// 5. ENTER·MOVE에 필요한 사용자 정보는 한 번만 읽는다.
		boolean needsCurrent = types.containsValue(RealtimeMessageType.VIEWPORT_ENTER)
				|| types.containsValue(RealtimeMessageType.VIEWPORT_MOVE);
		UserDisplay display = needsCurrent ? userDisplayService.find(event.email()) : null;
		Integer riderCount = needsCurrent ? riderCountService.count(event.email()) : null;
		// 표시 좌표는 화면 요청과 같은 원시 PC 값이다. 정규화(0~1)는 셀 계산 내부용이라 밖으로 내지 않는다.
		double[] position = needsCurrent ? rawPosition(newLocation, event.newLayer()) : null;

		// 6. 수신자를 따라오는 사람들을 한 번에 읽어 둔다.
		//    한 명씩 물으면 수신자 수만큼 왕복이 생겨 그대로 지연이 된다.
		Map<String, Set<String>> ridersByReceiver = rideViewportService.ridersOf(types.keySet());

		// 7. 수신자의 현재 화면 요청 순번을 넣어 개인 큐로 보낸다.
		//    따라오는 사람에게는 인솔자 것을 그대로 보낸다. 그쪽은 자기 순번이 없다.
		for (Map.Entry<String, RealtimeMessageType> entry : types.entrySet()) {
			String receiver = entry.getKey();
			RealtimeMessageType type = entry.getValue();
			ViewportDelta payload = type == RealtimeMessageType.VIEWPORT_LEAVE
					? leavePayload(metas.get(receiver).requestSeq(), event.email())
					: currentPayload(
							metas.get(receiver).requestSeq(), event, display, riderCount, position);
			realtimeMessageService.sendToUser(
					receiver, WebSocketDestination.QUEUE_PRESENCE, type, payload);
			rideViewportService.mirrorDelta(ridersByReceiver.get(receiver), type, payload);
		}
		recordDelta(startedAt, candidateCount, receiverCount, types.size());
	}

	/**
	 * 한 사람의 따라오는 인원수가 바뀌었다고 그 자리를 보고 있는 사람들에게 알린다.
	 *
	 * 선단은 남들 화면에 인솔자 한 점으로만 보인다. 몇 명이 붙어 있는지가 선단임을 아는
	 * 유일한 표시인데, 지금까지는 인솔자가 곡을 바꿔야만 갱신됐다. 스무 명이 타고 내려도
	 * 구경하는 쪽에는 계속 같은 수로 보였다.
	 *
	 * 자리가 바뀐 것이 아니라 숫자만 바뀐 것이라 위치 변경 알림을 쓰지 않는다.
	 *
	 * @param email 인원수가 바뀐 사람
	 * @param layer 그 사람이 있는 레이어
	 * @param musicId 그 사람이 있는 곡
	 * @param cell 그 곡이 있는 자리
	 * @param riderCount 바뀐 뒤의 인원수
	 */
	public void sendRiderCount(String email, int layer, long musicId, String cell, int riderCount) {
		Set<String> receivers = new LinkedHashSet<>(
				viewportRepository.findUsersWatchingCells(layer, cell, layer, cell));
		receivers.remove(email);
		if (receivers.isEmpty()) {
			return;
		}

		// 개별 사용자 방식인 화면만 남긴다. 묶음 방식은 사람을 하나씩 그리지 않는다.
		Map<String, ViewportMeta> metas = new LinkedHashMap<>(
				viewportRepository.findMetaByEmails(receivers));
		metas.entrySet().removeIf(entry -> entry.getValue().mode() != ViewportMode.INDIVIDUAL);
		if (metas.isEmpty()) {
			return;
		}

		double[] location = musicLocationService.findLocation(musicId).orElse(null);
		if (location == null) {
			return;
		}
		metas.entrySet().removeIf(entry -> !isVisible(entry.getValue(), layer, location));
		if (metas.isEmpty()) {
			return;
		}

		Map<String, Set<String>> ridersByReceiver = rideViewportService.ridersOf(metas.keySet());
		for (Map.Entry<String, ViewportMeta> entry : metas.entrySet()) {
			ViewportRiderCount payload = new ViewportRiderCount(
					entry.getValue().requestSeq(), email, riderCount);
			realtimeMessageService.sendToUser(entry.getKey(), WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.VIEWPORT_RIDER_COUNT, payload);
			rideViewportService.mirrorRiderCount(ridersByReceiver.get(entry.getKey()), payload);
		}
	}

	/**
	 * 여러 사람이 한 자리에 한꺼번에 나타났다고 알린다.
	 *
	 * 선단이 흩어질 때 쓴다. 한 명씩 알리면 사람 수만큼 알림이 나가고, 받는 쪽은
	 * 그 수만큼 다시 그리면서 중간 상태가 화면에 보인다. 그래서 한 덩어리로 보낸다.
	 *
	 * 전원이 인솔자의 마지막 곡에 남으므로 자리는 하나뿐이다.
	 *
	 * @param emails 나타난 사람들
	 * @param layer 그 곡이 있는 레이어
	 * @param musicId 사람들이 나타난 곡
	 * @param cell 그 곡이 있는 자리
	 */
	public void sendBulkEnter(List<String> emails, int layer, long musicId, String cell) {
		if (emails == null || emails.isEmpty()) {
			return;
		}
		// 1. 그 자리를 보고 있는 사람을 찾는다. 나타난 본인들은 뺀다.
		Set<String> receivers = new LinkedHashSet<>(
				viewportRepository.findUsersWatchingCells(layer, cell, layer, cell));
		receivers.removeAll(emails);
		if (receivers.isEmpty()) {
			return;
		}

		// 2. 개별 사용자 방식인 화면만 남긴다. 묶음 방식은 자리별 사람 수로 따로 받는다.
		Map<String, ViewportMeta> metas = new LinkedHashMap<>(
				viewportRepository.findMetaByEmails(receivers));
		metas.entrySet().removeIf(entry -> entry.getValue().mode() != ViewportMode.INDIVIDUAL);
		if (metas.isEmpty()) {
			return;
		}

		// 3. 그 곡이 각자의 화면 안에 실제로 들어오는지 본다.
		double[] location = musicLocationService.findLocation(musicId).orElse(null);
		if (location == null) {
			return;
		}
		metas.entrySet().removeIf(entry -> !isVisible(entry.getValue(), layer, location));
		if (metas.isEmpty()) {
			return;
		}
		double[] position = rawPosition(location, layer);

		// 4. 나타난 사람들의 정보는 한 번만 만든다. 받는 사람이 여럿이어도 내용은 같다.
		Map<String, Integer> riderCounts = riderCountService.countAll(emails);
		List<ViewportUser> users = emails.stream()
				.map(email -> {
					UserDisplay display = userDisplayService.find(email);
					return new ViewportUser(email, display.nickname(), display.imageUrl(),
							riderCounts.getOrDefault(email, 0));
				})
				.toList();

		// 5. 받는 사람의 화면 요청 번호만 갈아 끼워 개인 큐로 보낸다.
		Map<String, Set<String>> ridersByReceiver = rideViewportService.ridersOf(metas.keySet());
		for (Map.Entry<String, ViewportMeta> entry : metas.entrySet()) {
			ViewportBulkEnter payload = new ViewportBulkEnter(
					entry.getValue().requestSeq(), musicId, position[0], position[1], users);
			realtimeMessageService.sendToUser(entry.getKey(), WebSocketDestination.QUEUE_PRESENCE,
					RealtimeMessageType.VIEWPORT_BULK_ENTER, payload);
			rideViewportService.mirrorBulkEnter(ridersByReceiver.get(entry.getKey()), payload);
		}
	}

	/**
	 * 위치 변경 알림 처리 결과를 기록한다.
	 *
	 * @param startedAt 시작 시각
	 * @param candidateCount 처음 찾은 수신자 수
	 * @param receiverCount 실제 화면을 확인한 수신자 수
	 * @param sentCount 보낸 메시지 수
	 */
	private void recordDelta(
			long startedAt, int candidateCount, int receiverCount, int sentCount) {
		viewportMetrics.recordDelta(
				candidateCount, receiverCount, sentCount, System.nanoTime() - startedAt);
	}

	/**
	 * 이전 곡과 새 곡의 좌표를 한 번에 읽는다.
	 *
	 * @param event 이전 곡과 새 곡
	 * @return 곡 ID별 실제 좌표
	 */
	private Map<Long, double[]> findLocations(PositionChanged event) {
		Set<Long> musicIds = new LinkedHashSet<>();
		if (event.oldMusicId() != null) {
			musicIds.add(event.oldMusicId());
		}
		if (event.newMusicId() != null) {
			musicIds.add(event.newMusicId());
		}
		return musicIds.isEmpty()
				? Map.of()
				: musicLocationService.findLocations(List.copyOf(musicIds));
	}

	/**
	 * 저장된 화면에서 곡 위치가 실제로 보이는지 확인한다.
	 *
	 * @param meta 사용자가 보고 있는 화면
	 * @param layer 곡이 있는 레이어
	 * @param location 곡의 실제 좌표
	 * @return 화면에 보이면 true
	 */
	private boolean isVisible(ViewportMeta meta, Integer layer, double[] location) {
		if (layer == null || location == null || meta.viewport().layer() != layer) {
			return false;
		}
		int[] axes = musicPositionCalculator.findAxes(layer);
		if (location.length < axes[1]) {
			return false;
		}
		ViewportRange viewport = meta.viewport();
		return viewport.contains(location[axes[0] - 1], location[axes[1] - 1])
				&& viewport.satisfiesBounds(location);
	}

	/**
	 * 이전 곡 좌표가 없을 때 저장된 셀을 보고 있었는지 확인한다.
	 *
	 * @param meta 사용자가 보고 있는 화면
	 * @param layer 이전 레이어
	 * @param cellKey 이전 셀
	 * @return 이전 셀을 보고 있었으면 true
	 */
	private boolean watchesCell(ViewportMeta meta, Integer layer, String cellKey) {
		if (layer == null || cellKey == null || meta.viewport().layer() != layer) {
			return false;
		}
		for (Cell cell : meta.cells()) {
			if ((cell.cellX() + ":" + cell.cellY()).equals(cellKey)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * 이전·현재 표시 상태를 알림 종류로 바꾼다.
	 *
	 * @param sawOld 이전 위치가 보였는지
	 * @param seesNew 새 위치가 보이는지
	 * @return ENTER·MOVE·LEAVE. 변화가 없으면 null

	| 이전에 보임 | 지금 보임 | 결과 |
	|------------|---------|----|
	|    아니오   |   예    |ENTER|
	|      예    |  예      |MOVE|
	|      예    |   아니오 |LEAVE|
	|    아니오   | 아니오   |발송 안 함|
	 */
	private static RealtimeMessageType changeType(boolean sawOld, boolean seesNew) {
		if (sawOld && seesNew) {
			return RealtimeMessageType.VIEWPORT_MOVE;
		}
		if (seesNew) {
			return RealtimeMessageType.VIEWPORT_ENTER;
		}
		if (sawOld) {
			return RealtimeMessageType.VIEWPORT_LEAVE;
		}
		return null;
	}

	/**
	 * LEAVE로 보낼 화면 요청 순번과 사용자 이메일을 만든다.
	 *
	 * @param requestSeq 수신자의 화면 요청 순번
	 * @param email 화면에서 지울 사용자 이메일
	 * @return LEAVE 내용
	 */
	private static ViewportDelta leavePayload(long requestSeq, String email) {
		return new ViewportDelta(requestSeq, email, null, null, null, null, null, null);
	}

	/**
	 * ENTER·MOVE로 보낼 현재 사용자 정보를 만든다.
	 *
	 * @param requestSeq 수신자의 화면 요청 순번
	 * @param event 위치를 바꾼 사용자와 새 곡
	 * @param display 닉네임과 사진
	 * @param riderCount 따라오는 사용자 수
	 * @param position 새 위치의 원시 PC 좌표 {x, y}
	 * @return ENTER 또는 MOVE 내용
	 */
	private static ViewportDelta currentPayload(
			long requestSeq, PositionChanged event, UserDisplay display,
			int riderCount, double[] position) {
		return new ViewportDelta(
				requestSeq, event.email(), display.nickname(), display.imageUrl(),
				event.newMusicId(), position[0], position[1], riderCount);
	}

	/**
	 * 곡 좌표에서 그 레이어가 화면에 쓰는 두 축의 원시 값을 꺼낸다.
	 *
	 * @param location 곡의 16차원 좌표
	 * @param layer 현재 레이어
	 * @return {x, y} 원시 PC 좌표
	 */
	private double[] rawPosition(double[] location, int layer) {
		int[] axes = musicPositionCalculator.findAxes(layer);
		return new double[] {location[axes[0] - 1], location[axes[1] - 1]};
	}
}
