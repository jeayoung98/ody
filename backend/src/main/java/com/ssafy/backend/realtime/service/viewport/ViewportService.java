package com.ssafy.backend.realtime.service.viewport;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.service.user.UserDisplayService;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ReplaceResult;

import lombok.RequiredArgsConstructor;

/** 현재 화면 안의 사용자 목록을 만든다. */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class ViewportService {

	private static final int MAX_INDIVIDUAL_USERS = 20; // 화면에 따로 표시할 최대 사용자 수

	private final MusicPositionCalculator musicPositionCalculator; // 곡 좌표를 화면 위치와 셀로 변환
	private final RealtimeProperties properties; // 화면 셀 수 기준
	private final ViewportRedisRepository viewportRepository; // 화면 셀 구독 교체
	private final PresenceRedisRepository presenceRepository; // 셀의 곡과 곡의 사용자 조회
	private final MusicLocationService musicLocationService; // 곡 좌표 묶음 조회
	private final UserDisplayService userDisplayService; // 닉네임과 사진 조회
	private final RiderCountService riderCountService; // 따라오는 사용자 수 조회

	/**
	 * 화면의 셀을 구독하고 현재 화면 안 사용자 목록을 만든다.
	 * @param email 요청한 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @return 목록 생성 결과
	 */
	public OpenResult open(String email, long epoch, long requestSeq, ViewportRange viewport) {
		// 1. 화면 범위를 검사하고 화면에 걸친 셀을 찾는다.
		viewport.validate();
		List<Cell> cells = ViewportCellCalculator.findCellsInCurrentScreen(viewport, musicPositionCalculator).stream().toList();
		if (cells.size() > properties.viewport().clusterThresholdCells()) {
			return OpenResult.clusteredRequired();
		}

		// 2. 새 셀을 먼저 구독하고 오래된 요청은 멈춘다.
		ReplaceResult replaceResult = viewportRepository.replaceSubscriptions(
				email, epoch, requestSeq, viewport, new LinkedHashSet<>(cells));
		if (replaceResult == ReplaceResult.OLD_REQUEST) {
			return OpenResult.oldRequest();
		}
		if (replaceResult == ReplaceResult.STALE_CONNECTION) {
			return OpenResult.staleConnection();
		}

		// 3. 셀의 곡을 찾고 실제 화면 안에 있는 곡만 남긴다.
		Map<Cell, Set<Long>> musicIdsByCell = presenceRepository.findActiveMusicIdsByCell(
				viewport.layer(), cells);
		List<Long> candidateMusicIds = musicIdsByCell.values().stream()
				.flatMap(Set::stream)
				.distinct()
				.sorted()
				.toList();
		Map<Long, double[]> locations = musicLocationService.findLocations(candidateMusicIds);
		List<VisibleMusic> visibleMusic = findVisibleMusic(viewport, candidateMusicIds, locations);
		List<Long> visibleMusicIds = visibleMusic.stream().map(VisibleMusic::musicId).toList();

		// 4. 화면 안 곡의 사용자를 찾고 나와 중복 사용자를 뺀다.
		Map<Long, Set<String>> listenersByMusic = presenceRepository.findListenersByMusic(
				viewport.layer(), visibleMusicIds);

		Map<Long, List<String>> visibleListeners = findVisibleListeners(
				email, visibleMusicIds, listenersByMusic);
		int userCount = visibleListeners.values().stream().mapToInt(List::size).sum();
		if (userCount > MAX_INDIVIDUAL_USERS) {
			return OpenResult.clusteredRequired();
		}

		// 5. 곡 위치별 사용자 목록을 만들어 돌려준다.
		List<ViewportMusicGroup> groups = createGroups(visibleMusic, visibleListeners);
		return OpenResult.snapshot(ViewportSnapshot.individual(requestSeq, viewport.layer(), groups));
	}

	/**
	 * 후보 곡 중 현재 화면과 이전 화면을 모두 통과한 곡만 남긴다.
	 * @param viewport 현재 화면 범위
	 * @param musicIds 후보 곡 ID
	 * @param locations 곡 ID별 16차원 좌표
	 * @return 현재 화면에 실제로 있는 곡
	 */
	private List<VisibleMusic> findVisibleMusic(
			ViewportRange viewport, List<Long> musicIds, Map<Long, double[]> locations) {
		int[] axes = musicPositionCalculator.findAxes(viewport.layer());
		List<VisibleMusic> result = new ArrayList<>();
		for (Long musicId : musicIds) {
			double[] pc = locations.get(musicId);
			if (pc == null || pc.length < axes[1]) {
				continue;
			}
			double x = pc[axes[0] - 1];
			double y = pc[axes[1] - 1];
			if (!viewport.contains(x, y) || !viewport.satisfiesBounds(pc)) {
				continue;
			}
			result.add(new VisibleMusic(musicId, musicPositionCalculator.calculate(pc, viewport.layer())));
		}
		return result;
	}

	/**
	 * 요청자와 중복 사용자를 빼고 곡별 사용자 목록을 만든다.
	 * @param requesterEmail 요청한 사용자 이메일
	 * @param musicIds 화면 안 곡 ID
	 * @param listenersByMusic 곡별 청취자
	 * @return 곡별 화면 표시 사용자 이메일
	 */
	private static Map<Long, List<String>> findVisibleListeners(
			String requesterEmail,
			List<Long> musicIds,
			Map<Long, Set<String>> listenersByMusic) {
		Set<String> addedEmails = new LinkedHashSet<>();
		Map<Long, List<String>> result = new LinkedHashMap<>();
		for (Long musicId : musicIds) {
			List<String> listeners = listenersByMusic.getOrDefault(musicId, Set.of()).stream()
					.filter(email -> !email.equals(requesterEmail))
					.sorted()
					.filter(addedEmails::add)
					.toList();
			result.put(musicId, listeners);
		}
		return result;
	}

	/**
	 * 곡 위치와 사용자 정보를 화면 응답으로 묶는다.
	 * @param visibleMusic 화면 안 곡과 위치
	 * @param listenersByMusic 곡별 사용자 이메일
	 * @return 곡 위치별 사용자 목록
	 */
	private List<ViewportMusicGroup> createGroups(
			List<VisibleMusic> visibleMusic,
			Map<Long, List<String>> listenersByMusic) {
		Map<String, UserDisplay> displayByEmail = new LinkedHashMap<>();
		Map<String, Integer> riderCountByEmail = new LinkedHashMap<>();
		listenersByMusic.values().stream()
				.flatMap(List::stream)
				.forEach(email -> {
					displayByEmail.computeIfAbsent(email, userDisplayService::find);
					riderCountByEmail.computeIfAbsent(email, riderCountService::count);
				});

		List<ViewportMusicGroup> groups = new ArrayList<>();
		visibleMusic.stream()
				.sorted(Comparator.comparingLong(VisibleMusic::musicId))
				.forEach(music -> {
					List<ViewportUser> users = listenersByMusic.getOrDefault(music.musicId(), List.of()).stream()
							.map(email -> {
								UserDisplay display = displayByEmail.get(email);
								return new ViewportUser(
										email, display.nickname(), display.imageUrl(), riderCountByEmail.get(email));
							})
							.toList();
					if (!users.isEmpty()) {
						Placement calculate = music.placement();
						groups.add(new ViewportMusicGroup(
								music.musicId(), calculate.xNorm(), calculate.yNorm(), users));
					}
				});
		return groups;
	}

	/** 화면에 실제로 있는 곡과 표시 위치. */
	private record VisibleMusic(long musicId, Placement placement) {
	}

	/** 목록 생성 결과 종류. */
	public enum OpenStatus {
		SNAPSHOT,
		CLUSTERED_REQUIRED,
		OLD_REQUEST,
		STALE_CONNECTION
	}

	/**
	 * 목록 생성 결과.
	 * @param status 처리 결과 종류
	 * @param snapshot 개별 사용자 목록. 목록을 만들지 않았으면 null
	 */
	public record OpenResult(OpenStatus status, ViewportSnapshot snapshot) {

		/** 개별 사용자 목록을 돌려준다. */
		private static OpenResult snapshot(ViewportSnapshot snapshot) {
			return new OpenResult(OpenStatus.SNAPSHOT, snapshot);
		}

		/** 셀별 인원수 화면이 필요함을 알린다. */
		private static OpenResult clusteredRequired() {
			return new OpenResult(OpenStatus.CLUSTERED_REQUIRED, null);
		}

		/** 이미 더 새 요청이 적용됐음을 알린다. */
		private static OpenResult oldRequest() {
			return new OpenResult(OpenStatus.OLD_REQUEST, null);
		}

		/** 현재 접속과 다른 요청임을 알린다. */
		private static OpenResult staleConnection() {
			return new OpenResult(OpenStatus.STALE_CONNECTION, null);
		}
	}
}
