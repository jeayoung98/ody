package com.ssafy.backend.realtime.port;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.music.detail.MusicDetailReader;
import com.ssafy.backend.music.dto.Location;

/**
 * music 영역의 좌표 조회 기능을 realtime에서 쓰는 배열 형태로 바꾼다.
 */
@Component
@Profile("realtime")
public class MusicLocationAdapter implements MusicLocationPort {

	private static final int MAX_IDS_PER_QUERY = 30;

	private final MusicDetailReader musicDetailReader;

	public MusicLocationAdapter(MusicDetailReader musicDetailReader) {
		this.musicDetailReader = musicDetailReader;
	}

	/**
	 * 곡의 PC 좌표를 조회한다.
	 * @param musicId 곡 ID
	 * @return 길이 16 의 PC 좌표 배열(pc[0]=PC1 … pc[15]=PC16). 존재하지 않는 곡이면 empty.
	 */
	@Override
	public Optional<double[]> findLocation(long musicId) {
		return Optional.ofNullable(findLocations(List.of(musicId)).get(musicId));
	}

	/**
	 * 여러 곡의 좌표를 30개씩 나눠 읽는다.
	 * @param musicIds 곡 ID 목록
	 * @return 곡 ID별 16차원 좌표
	 */
	@Override
	public Map<Long, double[]> findLocations(List<Long> musicIds) {
		List<Long> uniqueIds = musicIds.stream()
				.filter(java.util.Objects::nonNull)
				.distinct()
				.toList();
		if (uniqueIds.isEmpty()) {
			return Map.of();
		}

		Map<Long, double[]> result = new LinkedHashMap<>();
		for (int start = 0; start < uniqueIds.size(); start += MAX_IDS_PER_QUERY) {
			int end = Math.min(start + MAX_IDS_PER_QUERY, uniqueIds.size());
			List<Long> batch = new ArrayList<>(uniqueIds.subList(start, end));
			musicDetailReader.findLocationsByIds(batch)
					.forEach((musicId, location) -> result.put(musicId, toArray(location)));
		}
		return result;
	}

	/**
	 * music 좌표를 realtime 계산용 배열로 바꾼다.
	 * @param location music 영역의 곡 좌표
	 * @return PC1부터 PC16까지 담은 배열
	 */
	private static double[] toArray(Location location) {
		return new double[] {
				location.pc1(), location.pc2(), location.pc3(), location.pc4(),
				location.pc5(), location.pc6(), location.pc7(), location.pc8(),
				location.pc9(), location.pc10(), location.pc11(), location.pc12(),
				location.pc13(), location.pc14(), location.pc15(), location.pc16()
		};
	}
}
