package com.ssafy.backend.music.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.music.retrieval.LayerBox;
import com.ssafy.backend.music.dto.MajorResponse;
import com.ssafy.backend.music.dto.MusicSummary;
import com.ssafy.backend.music.dto.PageResponse;
import com.ssafy.backend.music.dto.VideoIdBatchRequest;
import com.ssafy.backend.music.dto.VideoIdBatchResponse;
import com.ssafy.backend.music.service.MusicService;
import com.ssafy.backend.music.service.NearbyService;
import com.ssafy.backend.music.search.MusicSearchCondition;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import com.ssafy.backend.music.dto.MusicDetailResponse;
import com.ssafy.backend.music.dto.NearbyResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/music")
@Validated
@Tag(name = "Music", description = "곡 검색·상세·대표곡 조회")
public class MusicController {

	private final MusicService musicService;
	private final NearbyService nearbyService;

	public MusicController(MusicService musicService, NearbyService nearbyService) {
		this.musicService = musicService;
		this.nearbyService = nearbyService;
	}

	/**
	 * 레이어 상주 집합 조회 (D19). level=1 은 파라미터 없이, level>=2 는 이전 겹들의 사각 범위를
	 * 전부 받는다 — 서버는 탐색 상태를 보관하지 않는다.
	 *
	 * 범위 파라미터 표기는 {@link #rangeParam} 한 곳에서만 만든다. FE1 통보가 오면 거기만 바꾼다.
	 */
	@Operation(summary = "레이어 상주 집합 조회", description = "level=1은 범위 없이, level>=2는 이전 겹들의 사각 범위를 모두 받는다. size는 1~10000곡의 반환 상한이다.")
	@GetMapping("/major")
	public ApiResponse<MajorResponse> major(
			@RequestParam(defaultValue = "1") @Min(1) @Max(8) int level,
			@RequestParam(required = false) @Min(1) @Max(10000) Integer size,
			@RequestParam Map<String, String> params) {
		return ApiResponse.success(musicService.getMajor(level, accumulatedBoxes(level, params), size));
	}

	/**
	 * 누적 축 범위 파라미터 이름. <b>표기를 바꾸는 지점은 여기 하나뿐이다.</b>
	 *
	 * <p>BE2 제안 {@code pc{n}min}·{@code pc{n}max} 로 잠정 구현했다. FE1 은 "GET 으로 받는다"
	 * 까지만 확정했고 이름은 미정이다 — 설계가 아니라 표기 문제라 FE 편한 쪽으로 맞춘다
	 * ({@code specs/001-pc-major-tracks/contracts/music-major.md} §1 미정).
	 */
	private static String rangeParam(int axis, String bound) {
		return "pc" + axis + bound;
	}

	/**
	 * 레이어 1..level-1 의 사각 범위를 요청 파라미터에서 읽는다. level=1 이면 빈 목록이다(FR-004).
	 * 개수는 {@code MajorQuery} 가 강제한다 — 범위가 모자라면 후보가 조용히 넓어진다(FR-008).
	 *
	 * ponytail: 값 자체의 오류 규칙(min > max, 비유한 수, 레벨 상한)은 B1 미정이라 정하지 않는다.
	 * 여기서는 누락·비수치를 400 INVALID_INPUT 으로만 돌린다.
	 */
	private static List<LayerBox> accumulatedBoxes(int level, Map<String, String> params) {
		List<LayerBox> boxes = new ArrayList<>();
		for (int layer = 1; layer < level; layer++) {
			int axisX = 2 * layer - 1;
			int axisY = 2 * layer;
			boxes.add(new LayerBox(layer,
					required(params, axisX, "min"), required(params, axisY, "min"),
					required(params, axisX, "max"), required(params, axisY, "max")));
		}
		return boxes;
	}

	private static double required(Map<String, String> params, int axis, String bound) {
		String name = rangeParam(axis, bound);
		String raw = params.get(name);
		if (raw == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		try {
			return Double.parseDouble(raw);
		} catch (NumberFormatException e) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
	}

	/**
	 * 음악 검색 (정본 §3.1). query 통합 검색 또는 artist(+music) 앞일치 필터, page 0-based.
	 */
	@Operation(summary = "음악 검색", description = "query 통합 검색 또는 artist(+music) 앞일치 조건으로 음악을 검색한다. page는 0-based다.")
	@GetMapping("/search")
	public ApiResponse<PageResponse<MusicSummary>> search(
			@RequestParam(required = false) String query,
			@RequestParam(required = false) String music,
			@RequestParam(required = false) String artist,
			@RequestParam @Min(0) int page) {
		return ApiResponse.success(musicService.search(new MusicSearchCondition(query, music, artist), page));
	}

	/**
	 * 노래 상세 조회 (정본 §3.2). id로 상세 + 최근접 10곡(neighbors). 없는 곡 → 404 MUSIC_NOT_FOUND.
	 */
	@Operation(summary = "노래 상세 조회", description = "id로 노래 상세와 최근접 10곡(neighbors)을 함께 조회한다. 없는 곡이면 404 MUSIC_NOT_FOUND.")
	@GetMapping("/detail")
	public ApiResponse<MusicDetailResponse> detail(@RequestParam @Min(1) long id) {
		return ApiResponse.success(musicService.getDetail(id));
	}

	/**
	 * 주변 탐색 (정본 §3.5). 기준 곡에서 가까운 곡을 선정 규칙을 통과한 최대 10곡까지 반환한다.
	 *
	 * <p>이웃 곡을 다시 기준점으로 요청해 탐색을 이어갈 수 있다(MAP-10). 서버는 탐색 상태를 보관하지 않는다.
	 *
	 * <p><b>인증 대상이다</b>(정본 §0.1·§0.7). 다만 현재 {@code SecurityConfig} 가 {@code permitAll} 이라
	 * 실제로는 열려 있다 — 그것은 S15P21A405-33 의 <b>의도된 임시 상태</b>이고 BE1 소유라 여기서 되돌리지 않는다.
	 *
	 * <p>기준점을 좌표로도 받을지는 FE 확인 대기다(005 D-CENTER-B). 지금은 곡 id 만 받는다.
	 */
	@Operation(summary = "주변 탐색", description = "기준 곡에서 가까운 곡을 선정 규칙을 통과한 최대 10곡까지 반환한다. 이웃 곡을 다시 기준점으로 요청해 탐색을 이어갈 수 있다.")
	@GetMapping("/nearby")
	public ApiResponse<NearbyResponse> nearby(@RequestParam @Min(1) long id) {
		return ApiResponse.success(nearbyService.findNearby(id));
	}

	/**
	 * musicId 목록 → videoId 일괄 조회 (S15P21A405-322, 프로토타입). 최대 {@value VideoIdBatchRequest#MAX_IDS}개.
	 *
	 * <p>DB 에 이미 있으면 그대로 내려주고, 없으면 외부 videoid API(EC2:8001) 를 호출해 채운 뒤 저장한다.
	 * spec 006 FR-006(길이·embeddable 검증)은 적용하지 않는다 — 팀 상의 전 임시 경로다.
	 */
	@Operation(summary = "videoId 일괄 조회", description = "musicId 목록으로 videoId를 일괄 조회한다. DB에 있으면 그대로 내려주고, 없으면 외부 videoId API를 호출해 채운 뒤 저장한다.")
	@PostMapping("/videoid")
	public ApiResponse<VideoIdBatchResponse> videoIds(@RequestBody @Valid VideoIdBatchRequest request) {
		return ApiResponse.success(musicService.getVideoIds(request.musicIds()));
	}
}
