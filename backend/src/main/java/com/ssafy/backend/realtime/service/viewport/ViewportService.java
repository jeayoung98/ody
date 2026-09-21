package com.ssafy.backend.realtime.service.viewport;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.realtime.config.RealtimeProperties;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.CombinedCells;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.CellCenter;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator.Placement;
import com.ssafy.backend.realtime.geometry.ViewportRange;
import com.ssafy.backend.realtime.observability.ViewportMetrics;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.service.user.UserDisplayService;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportCellCount;
import com.ssafy.backend.realtime.dto.viewport.ViewportSnapshot;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.dto.viewport.ViewportMode;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.CloseResult;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository.PresenceSnapshot;
import com.ssafy.backend.realtime.repository.redis.ViewportRedisRepository.ReplaceResult;

import lombok.RequiredArgsConstructor;

/** 현재 화면 안의 사용자 목록을 만든다. */
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class ViewportService {

	private final MusicPositionCalculator musicPositionCalculator; // 곡 좌표를 화면 위치와 셀로 변환
	private final RealtimeProperties properties; // 화면 셀 수 기준
	private final ViewportRedisRepository viewportRepository; // 화면 셀 구독 교체
	private final PresenceRedisRepository presenceRepository; // 셀의 곡과 곡의 사용자 조회
	private final MusicLocationService musicLocationService; // 곡 좌표 묶음 조회
	private final UserDisplayService userDisplayService; // 닉네임과 사진 조회
	private final RiderCountService riderCountService; // 따라오는 사용자 수 조회
	private final ViewportMetrics viewportMetrics; // 화면 처리 크기와 시간 기록

	/**
	 * 현재 화면의 셀 구독과 사용자 목록을 갱신한다.
	 *
	 * @param email 요청한 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @return 화면 갱신 결과
	 */
	public OpenResult updateCurrentScreen(String email, long epoch, long requestSeq, ViewportRange viewport) {
		long startedAt = System.nanoTime();
		// 1. 화면 범위를 검사하고 화면에 걸친 셀을 찾는다.
		viewport.validate();
		List<Cell> cells = ViewportCellCalculator.findCellsInCurrentScreen(viewport, musicPositionCalculator).stream().toList();
		if (cells.size() > properties.viewport().clusterThresholdCells()) {
			return recordCurrentScreenResult(startedAt,
					replaceWithCellCountSnapshot(email, epoch, requestSeq, viewport, cells),
					cells.size(), 0, 0);
		}

		// 2. 새 셀을 먼저 구독하고 오래된 요청은 멈춘다.
		ReplaceResult replaceResult = viewportRepository.replaceSubscriptions(
				email, epoch, requestSeq, viewport,
				ViewportMode.INDIVIDUAL, new LinkedHashSet<>(cells));
		if (replaceResult == ReplaceResult.OLD_REQUEST) {
			return recordCurrentScreenResult(startedAt, OpenResult.oldRequest(), cells.size(), 0, 0);
		}
		if (replaceResult == ReplaceResult.STALE_CONNECTION) {
			return recordCurrentScreenResult(startedAt, OpenResult.staleConnection(), cells.size(), 0, 0);
		}

		// 3. 화면 안 곡과 그 곡을 듣는 사람으로 목록을 만든다.
		Individual individual = createIndividual(email, requestSeq, viewport, cells);

		// 4. 사람이 너무 많으면 한 명씩 대신 자리별 인원수로 바꾼다.
		if (individual.snapshot() == null) {
			return recordCurrentScreenResult(startedAt,
					replaceWithCellCountSnapshot(email, epoch, requestSeq, viewport, cells),
					cells.size(), individual.candidateCount(), individual.userCount());
		}
		return recordCurrentScreenResult(startedAt, OpenResult.snapshot(individual.snapshot()),
				cells.size(), individual.candidateCount(), individual.userCount());
	}

	/**
	 * 저장해 둔 화면 범위로 목록만 다시 만든다. 구독은 건드리지 않는다.
	 *
	 * 따라가는 사람에게 인솔자 화면을 옮겨 줄 때 쓴다. 인솔자가 이미 열어 둔 화면이라
	 * 구독을 다시 손대면 안 되고, 목록에서 빠지는 사람도 인솔자 기준이어야 한다.
	 *
	 * @param email 이 목록의 주인. 이 사람은 목록에서 빠진다
	 * @param mode 저장된 표시 방식
	 * @param requestSeq 저장된 화면 요청 순번
	 * @param viewport 저장된 화면 범위
	 * @return 목록
	 */
	public ViewportSnapshot createSnapshot(
			String email, ViewportMode mode, long requestSeq, ViewportRange viewport) {
		viewport.validate();
		List<Cell> cells = ViewportCellCalculator
				.findCellsInCurrentScreen(viewport, musicPositionCalculator).stream().toList();
		if (mode == ViewportMode.CLUSTERED
				|| cells.size() > properties.viewport().clusterThresholdCells()) {
			return createCellCountSnapshot(email, requestSeq, viewport, cells);
		}
		Individual individual = createIndividual(email, requestSeq, viewport, cells);
		return individual.snapshot() != null
				? individual.snapshot()
				: createCellCountSnapshot(email, requestSeq, viewport, cells);
	}

	/**
	 * 화면 안 곡과 사용자를 찾아 한 명씩 보여 주는 목록을 만든다.
	 *
	 * @param email 요청한 사용자 이메일. 이 사람은 목록에서 빠진다
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 화면 범위
	 * @param cells 화면이 걸치는 셀
	 * @return 목록과 세어 본 값. 사람이 정원을 넘으면 목록은 null
	 */
	private Individual createIndividual(
			String email, long requestSeq, ViewportRange viewport, List<Cell> cells) {
		// 1. 셀의 곡을 찾고 실제 화면 안에 있는 곡만 남긴다.
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

		// 2. 화면 안 곡의 사용자를 찾고 나와 중복 사용자를 뺀다.
		Map<Long, Set<String>> listenersByMusic = presenceRepository.findListenersByMusic(
				viewport.layer(), visibleMusicIds);
		Map<Long, List<String>> visibleListeners = findVisibleListeners(
				email, visibleMusicIds, listenersByMusic);
		int userCount = visibleListeners.values().stream().mapToInt(List::size).sum();
		if (userCount > properties.viewport().individualUserCap()) {
			return new Individual(null, candidateMusicIds.size(), userCount);
		}

		// 3. 곡 위치별 사용자 목록을 만든다.
		List<ViewportMusicGroup> groups = createGroups(visibleMusic, visibleListeners);
		return new Individual(
				ViewportSnapshot.individual(requestSeq, viewport.layer(), groups),
				candidateMusicIds.size(), userCount);
	}

	/**
	 * 한 명씩 보여 주는 목록과 만들면서 세어 본 값.
	 *
	 * @param snapshot 목록. 사람이 정원을 넘어 만들지 않았으면 null
	 * @param candidateCount 확인한 곡 수
	 * @param userCount 확인한 사용자 수
	 */
	private record Individual(ViewportSnapshot snapshot, int candidateCount, int userCount) {
	}

	/**
	 * 화면 목록 처리 결과를 기록하고 그대로 돌려준다.
	 *
	 * @param startedAt 시작 시각
	 * @param result 화면 갱신 결과
	 * @param cellCount 확인한 셀 수
	 * @param candidateCount 확인한 곡 수
	 * @param userCount 확인한 사용자 수
	 * @return 화면 갱신 결과
	 */
	private OpenResult recordCurrentScreenResult(
			long startedAt, OpenResult result,
			int cellCount, int candidateCount, int userCount) {
		String mode = result.snapshot() == null ? "NONE" : result.snapshot().mode().name();
		viewportMetrics.recordSnapshot(
				result.status().name(), mode, cellCount, candidateCount, userCount,
				System.nanoTime() - startedAt);
		return result;
	}

	/**
	 * 현재 접속에서 마지막으로 연 화면의 구독을 닫는다.
	 *
	 * @param email 요청한 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 마지막 화면 요청 순번
	 */
	public void closeCurrentScreen(String email, long epoch, long requestSeq) {
		CloseResult result = viewportRepository.closeCurrentScreen(email, epoch, requestSeq);
		viewportMetrics.recordClose(result.name());
	}

	/**
	 * 개별 셀 구독을 지우고 셀별 인원수 화면으로 바꾼다.
	 *
	 * @param email 요청한 사용자 이메일
	 * @param epoch 현재 접속 번호
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @param cells 현재 화면의 기본 셀
	 * @return 화면 갱신 결과
	 */
	private OpenResult replaceWithCellCountSnapshot(
			String email, long epoch, long requestSeq, ViewportRange viewport, List<Cell> cells) {
		ReplaceResult replaceResult = viewportRepository.replaceSubscriptions(
				email, epoch, requestSeq, viewport, ViewportMode.CLUSTERED, Set.of());
		if (replaceResult == ReplaceResult.OLD_REQUEST) {
			return OpenResult.oldRequest();
		}
		if (replaceResult == ReplaceResult.STALE_CONNECTION) {
			return OpenResult.staleConnection();
		}
		return OpenResult.snapshot(createCellCountSnapshot(email, requestSeq, viewport, cells));
	}

	/**
	 * 현재 화면의 셀별 사용자 수를 만든다.
	 *
	 * @param email 요청한 사용자 이메일
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 현재 화면 범위
	 * @param cells 현재 화면이 걸치는 기본 셀
	 * @return 셀을 합친 사용자 수 응답
	 */
	public ViewportSnapshot createCellCountSnapshot(
			String email, long requestSeq, ViewportRange viewport, List<Cell> cells) {
		viewport.validate();
		Map<Cell, Integer> counts = viewport.layer() == 0
				? findFirstLayerCellCounts(email, viewport.layer(), cells)
				: findDeepLayerCellCounts(email, viewport, cells);
		CombinedCells combined = ViewportCellCalculator.combineNearbyCellsForDisplay(
				counts, properties.viewport().markerCap(), properties.viewport().gridSize());
		List<ViewportCellCount> resultCells = createCellCountResponses(viewport, combined);
		return ViewportSnapshot.clustered(
				requestSeq, viewport.layer(), combined.cellsPerRow(), resultCells);
	}

	/**
	 * 저장된 화면 범위로 최신 셀별 사용자 수를 만든다.
	 *
	 * @param email 받을 사용자 이메일
	 * @param requestSeq 화면 요청 순번
	 * @param viewport 저장된 화면 범위
	 * @return 셀별 사용자 수 응답
	 */
	public ViewportSnapshot createCellCountSnapshot(
			String email, long requestSeq, ViewportRange viewport) {
		List<Cell> cells = ViewportCellCalculator
				.findCellsInCurrentScreen(viewport, musicPositionCalculator)
				.stream()
				.toList();
		return createCellCountSnapshot(email, requestSeq, viewport, cells);
	}

	/**
	 * 첫 레이어(0)의 셀별 사용자 수를 가져오고 요청자를 뺀다.
	 *
	 * @param email 요청한 사용자 이메일
	 * @param layer 현재 레이어
	 * @param cells 현재 화면의 셀
	 * @return 셀별 사용자 수
	 */
	private Map<Cell, Integer> findFirstLayerCellCounts(String email, int layer, List<Cell> cells) {
		Map<Cell, Integer> counts = new LinkedHashMap<>(
				viewportRepository.findUserCountsByCell(layer, cells));
		PresenceSnapshot requester = presenceRepository.snapshot(email);
		if (requester != null && Objects.equals(requester.layer(), layer)
				&& requester.cellX() != null && requester.cellY() != null) {
			excludeRequester(counts, new Cell(requester.cellX(), requester.cellY()));
		}
		return counts;
	}

	/**
	 * 두 번째 레이어부터 실제 화면 안 곡을 골라 셀별 사용자 수를 센다.
	 *
	 * @param email 요청한 사용자 이메일
	 * @param viewport 현재 화면 범위
	 * @param cells 현재 화면의 셀
	 * @return 셀별 사용자 수
	 */
	private Map<Cell, Integer> findDeepLayerCellCounts(
			String email, ViewportRange viewport, List<Cell> cells) {
		Map<Cell, Set<Long>> musicIdsByCell = presenceRepository.findActiveMusicIdsByCell(
				viewport.layer(), cells);
		List<Long> candidateMusicIds = musicIdsByCell.values().stream()
				.flatMap(Set::stream)
				.distinct()
				.sorted()
				.toList();
		Map<Long, double[]> locations = musicLocationService.findLocations(candidateMusicIds);
		List<VisibleMusic> visibleMusic = findVisibleMusic(
				viewport, candidateMusicIds, locations);
		List<Long> visibleMusicIds = visibleMusic.stream().map(VisibleMusic::musicId).toList();
		Map<Long, Integer> listenerCounts = presenceRepository.findListenerCountsByMusic(
				viewport.layer(), visibleMusicIds);
		PresenceSnapshot requester = presenceRepository.snapshot(email);

		Map<Cell, Integer> result = new LinkedHashMap<>();
		for (VisibleMusic music : visibleMusic) {
			int count = listenerCounts.getOrDefault(music.musicId(), 0);
			if (requester != null
					&& Objects.equals(requester.layer(), viewport.layer())
					&& Objects.equals(requester.musicId(), music.musicId())) {
				count--;
			}
			if (count > 0) {
				Cell cell = new Cell(music.placement().cellX(), music.placement().cellY());
				result.merge(cell, count, Math::addExact);
			}
		}
		return result;
	}

	/**
	 * 요청자가 있는 셀에서 한 명을 뺀다.
	 *
	 * @param counts 셀별 사용자 수
	 * @param cell 요청자가 있는 셀
	 */
	private static void excludeRequester(Map<Cell, Integer> counts, Cell cell) {
		Integer count = counts.get(cell);
		if (count == null) {
			return;
		}
		if (count <= 1) {
			counts.remove(cell);
		} else {
			counts.put(cell, count - 1);
		}
	}

	/**
	 * 합친 셀마다 인원수와 지도 표시 위치를 만든다.
	 *
	 * @param viewport 현재 화면 범위
	 * @param combined 합친 셀과 사용자 수
	 * @return 화면에 표시할 셀별 정보
	 */
	private List<ViewportCellCount> createCellCountResponses(
			ViewportRange viewport, CombinedCells combined) {
		return combined.userCountByCell().entrySet().stream()
				.sorted(Map.Entry.comparingByKey(Comparator
						.comparingInt(Cell::cellX)
						.thenComparingInt(Cell::cellY)))
				.map(entry -> {
					Cell cell = entry.getKey();
					CellCenter center = musicPositionCalculator.findCellCenter(
							viewport.layer(), cell.cellX(), cell.cellY(), combined.cellsPerRow());
					double x = Math.max(viewport.minX(), Math.min(center.x(), viewport.maxX()));
					double y = Math.max(viewport.minY(), Math.min(center.y(), viewport.maxY()));
					return new ViewportCellCount(cell.cellX(), cell.cellY(), x, y, entry.getValue());
				})
				.toList();
	}

	/**
	 * 후보 곡 중 현재 화면과 이전 화면을 모두 통과한 곡만 남긴다.
	 *
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
			result.add(new VisibleMusic(
					musicId, x, y, musicPositionCalculator.calculate(pc, viewport.layer())));
		}
		return result;
	}

	/**
	 * 요청자와 중복 사용자를 빼고 곡별 사용자 목록을 만든다.
	 *
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
	 *
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
						// 화면 요청·셀 인원수와 같은 원시 PC 좌표로 준다. 정규화(0~1)는 셀 계산 내부용이다.
						groups.add(new ViewportMusicGroup(music.musicId(), music.x(), music.y(), users));
					}
				});
		return groups;
	}

	/**
	 * 화면에 실제로 있는 곡과 표시 위치.
	 *
	 * @param x 현재 레이어 가로축의 원시 PC 좌표 (프론트 지도 좌표계)
	 * @param y 현재 레이어 세로축의 원시 PC 좌표
	 * @param placement 셀 계산용 배치 (정규화 좌표·셀 번호)
	 */
	private record VisibleMusic(long musicId, double x, double y, Placement placement) {
	}

	/** 목록 생성 결과 종류. */
	public enum OpenStatus {
		SNAPSHOT,
		OLD_REQUEST,
		STALE_CONNECTION
	}

	/**
	 * 목록 생성 결과.
	 *
	 * @param status 처리 결과 종류
	 * @param snapshot 개별 사용자 목록. 목록을 만들지 않았으면 null
	 */
	public record OpenResult(OpenStatus status, ViewportSnapshot snapshot) {

		/**
		 * 개별 사용자 목록 결과를 만든다.
		 *
		 * @param snapshot 개별 사용자 목록
		 * @return 목록 생성 결과
		 */
		private static OpenResult snapshot(ViewportSnapshot snapshot) {
			return new OpenResult(OpenStatus.SNAPSHOT, snapshot);
		}

		/**
		 * 더 새 요청이 이미 적용된 결과를 만든다.
		 *
		 * @return 목록 생성 결과
		 */
		private static OpenResult oldRequest() {
			return new OpenResult(OpenStatus.OLD_REQUEST, null);
		}

		/**
		 * 현재 접속과 다른 요청의 결과를 만든다.
		 *
		 * @return 목록 생성 결과
		 */
		private static OpenResult staleConnection() {
			return new OpenResult(OpenStatus.STALE_CONNECTION, null);
		}
	}
}
