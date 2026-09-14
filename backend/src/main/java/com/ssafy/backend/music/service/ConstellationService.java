package com.ssafy.backend.music.service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.MusicErrorCode;
import com.ssafy.backend.music.constellation.PlanarProjection;
import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.ConstellationLayoutRequest;
import com.ssafy.backend.music.dto.ConstellationLayoutResponse;
import com.ssafy.backend.music.dto.ConstellationPoint;
import com.ssafy.backend.music.dto.Location;

import lombok.extern.slf4j.Slf4j;

/**
 * 별자리 배치 (PATH-01, BACKEND-NOTES A-9).
 *
 * <p>곡 좌표를 한 번에 읽어 {@link PlanarProjection} 으로 2D 로 누르고, 요청 순서대로 되돌린다.
 * 조회 전용이며 어떤 도메인에도 쓰지 않는다.
 */
@Slf4j
@Service
public class ConstellationService {

	private final Optional<MusicDetailReader> musicDetailReader;

	// ponytail: MusicService·PlaylistService 와 같은 패턴. 조회 어댑터가 없는 구성에서도 컨텍스트가 뜬다.
	public ConstellationService(Optional<MusicDetailReader> musicDetailReader) {
		this.musicDetailReader = musicDetailReader;
	}

	/**
	 * 곡 집합의 2D 배치를 만든다.
	 *
	 * @throws CustomException 개수·중복·값 위반이면 {@code INVALID_INPUT}(400),
	 *                         요청한 곡 중 하나라도 없거나 좌표가 없으면 {@code MUSIC_NOT_FOUND}(404)
	 */
	public ConstellationLayoutResponse layout(List<Long> musicIds) {
		validate(musicIds);

		Map<Long, Location> locations = reader().findLocationsByIds(musicIds);
		// musicIds 는 중복이 없으므로 개수만 비교하면 누락 판정이 끝난다.
		// 부분 배치를 200 으로 내면 모양이 조용히 달라지고 호출자는 알 방법이 없다(FR-014).
		if (locations.size() != musicIds.size()) {
			throw new CustomException(MusicErrorCode.MUSIC_NOT_FOUND);
		}

		Map<Long, double[]> coords = new LinkedHashMap<>();
		locations.forEach((musicId, location) -> coords.put(musicId, toCoordinates(location)));
		Map<Long, PlanarProjection.Point> projected = PlanarProjection.project(coords);

		ConstellationLayoutResponse response = new ConstellationLayoutResponse(musicIds.stream()
				.map(musicId -> {
					PlanarProjection.Point point = projected.get(musicId);
					return new ConstellationPoint(musicId, point.x(), point.y());
				})
				.toList());
		log.info("[Constellation] 별자리 배치 완료 count={}", musicIds.size());
		return response;
	}

	private MusicDetailReader reader() {
		return musicDetailReader.orElseThrow(
				() -> new UnsupportedOperationException("constellations/layout: 곡 좌표 조회 어댑터 없음"));
	}

	/**
	 * 컨트롤러의 {@code @Valid} 와 중복되지만 서비스도 단독으로 성립해야 한다.
	 * 중복 id 는 애너테이션으로 표현할 수 없어 여기서만 걸린다.
	 */
	private static void validate(List<Long> musicIds) {
		if (musicIds == null
				|| musicIds.size() < ConstellationLayoutRequest.MIN_TRACKS
				|| musicIds.size() > ConstellationLayoutRequest.MAX_TRACKS) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		if (musicIds.stream().anyMatch(musicId -> musicId == null || musicId < 1)) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		// 조용히 합치지 않는다 — 요청한 곡 수와 그려진 별 수가 달라지면 호출자가 알 방법이 없다(헌법 VI).
		if (new HashSet<>(musicIds).size() != musicIds.size()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
	}

	/**
	 * 저장 컬럼이 {@code vector(16)}(= float4)라 {@code toArray()} 의 단정밀도에서 잃는 것이 없다.
	 * 누적은 double 로 한다.
	 */
	private static double[] toCoordinates(Location location) {
		float[] source = location.toArray();
		double[] coordinates = new double[source.length];
		for (int d = 0; d < source.length; d++) {
			coordinates[d] = source[d];
		}
		return coordinates;
	}
}
