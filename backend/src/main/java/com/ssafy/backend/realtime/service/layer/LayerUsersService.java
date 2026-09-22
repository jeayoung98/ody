package com.ssafy.backend.realtime.service.layer;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.realtime.dto.layer.LayerUsersSnapshot;
import com.ssafy.backend.realtime.dto.presence.UserDisplay;
import com.ssafy.backend.realtime.dto.viewport.ViewportMusicGroup;
import com.ssafy.backend.realtime.dto.viewport.ViewportUser;
import com.ssafy.backend.realtime.geometry.MusicPositionCalculator;
import com.ssafy.backend.realtime.geometry.ViewportCellCalculator.Cell;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;
import com.ssafy.backend.realtime.service.music.MusicLocationService;
import com.ssafy.backend.realtime.service.nearby.RiderCountService;
import com.ssafy.backend.realtime.service.user.UserDisplayService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 한 레이어에서 재생 중인 사용자 전부를 곡 위치별로 모은다.
 *
 * 화면(viewport) 목록은 화면 범위 안만 주고 셀이 많으면 인원수로 바꾸는데, 지도는 줌아웃해도
 * 사용자를 전부 개별로 그리기로 했다. 그래서 화면 범위·구독·인원수 전환 없이 레이어 전체를 한 번에 읽는다.
 * Redis 는 읽기만 한다 — 키를 채우는 쪽은 재생 선언(presence-play.lua)이다.
 */
@Slf4j
@Service
@Profile("realtime")
@RequiredArgsConstructor
public class LayerUsersService {

	private final MusicPositionCalculator musicPositionCalculator; // 레이어 검증·표시축
	private final PresenceRedisRepository presenceRepository; // 셀의 곡과 곡의 사용자
	private final MusicLocationService musicLocationService; // 곡 좌표 묶음 조회
	private final UserDisplayService userDisplayService; // 닉네임·사진
	private final RiderCountService riderCountService; // 따라오는 인원 수

	/**
	 * 레이어의 재생 중 사용자 전부를 돌려준다.
	 *
	 * @param layer 조회할 레이어 (0-based)
	 * @param requesterEmail 요청한 사람. 목록에서 빠진다. null 이면 아무도 빼지 않는다
	 * @return 곡 위치별 사용자 목록. 좌표를 모르는 곡은 건너뛴다
	 * @throws CustomException 레이어가 범위 밖이면 INVALID_INPUT
	 */
	public LayerUsersSnapshot findAll(int layer, String requesterEmail) {
		int[] axes;
		try {
			axes = musicPositionCalculator.findAxes(layer);
		} catch (IllegalArgumentException e) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}

		// 1. 레이어의 셀 전부에서 재생 중인 곡을 한 번에 읽는다.
		//    ponytail: 격자 전체(16x16=256키) 파이프라인 1회. 격자가 커지면 active-song:cells:{layer} 로 점유 셀만 읽는 메서드 추가.
		Map<Cell, Set<Long>> musicIdsByCell = presenceRepository.findActiveMusicIdsByCell(layer, allCells());
		List<Long> musicIds = musicIdsByCell.values().stream()
				.flatMap(Set::stream)
				.distinct()
				.sorted()
				.toList();
		if (musicIds.isEmpty()) {
			return new LayerUsersSnapshot(layer, List.of());
		}

		// 2. 곡 좌표와 곡별 청취자를 읽는다.
		Map<Long, double[]> locations = musicLocationService.findLocations(musicIds);
		Map<Long, Set<String>> listenersByMusic = presenceRepository.findListenersByMusic(layer, musicIds);
		Set<String> everyone = new LinkedHashSet<>();
		listenersByMusic.values().forEach(everyone::addAll);
		if (requesterEmail != null) {
			everyone.remove(requesterEmail);
		}
		Map<String, Integer> riderCounts = riderCountService.countAll(everyone);

		// 3. 곡 위치별로 사용자를 묶는다.
		List<ViewportMusicGroup> groups = new ArrayList<>();
		for (Long musicId : musicIds) {
			double[] pc = locations.get(musicId);
			if (pc == null || pc.length < axes[1]) {
				log.warn("[LayerUsers] 좌표 없는 곡 건너뜀 layer={} musicId={}", layer, musicId);
				continue;
			}
			List<ViewportUser> users = new ArrayList<>();
			for (String email : listenersByMusic.getOrDefault(musicId, Set.of())) {
				if (!everyone.contains(email)) {
					continue; // 요청자 본인
				}
				UserDisplay display = userDisplayService.find(email);
				users.add(new ViewportUser(email, display.nickname(), display.imageUrl(),
						riderCounts.getOrDefault(email, 0)));
			}
			if (users.isEmpty()) {
				continue;
			}
			groups.add(new ViewportMusicGroup(musicId, pc[axes[0] - 1], pc[axes[1] - 1], users));
		}

		log.info("[LayerUsers] layer={} 곡수={} 사람수={}", layer, groups.size(),
				groups.stream().mapToInt(g -> g.users().size()).sum());
		return new LayerUsersSnapshot(layer, groups);
	}

	/** 격자의 모든 셀 (0..grid-1)². */
	private List<Cell> allCells() {
		int grid = musicPositionCalculator.grid();
		List<Cell> cells = new ArrayList<>(grid * grid);
		for (int y = 0; y < grid; y++) {
			for (int x = 0; x < grid; x++) {
				cells.add(new Cell(x, y));
			}
		}
		return cells;
	}
}
