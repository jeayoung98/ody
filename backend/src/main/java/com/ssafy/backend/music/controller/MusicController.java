package com.ssafy.backend.music.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
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
import com.ssafy.backend.music.service.MusicService;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import com.ssafy.backend.music.dto.MusicDetailResponse;

import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/music")
@Validated
@Tag(name = "Music", description = "곡 검색·상세·대표곡 조회")
public class MusicController {

	private final MusicService musicService;

	public MusicController(MusicService musicService) {
		this.musicService = musicService;
	}

	/**
	 * 레이어 상주 집합 조회 (D19). level=1 은 파라미터 없이, level>=2 는 이전 겹들의 사각 범위를
	 * 전부 받는다 — 서버는 탐색 상태를 보관하지 않는다.
	 *
	 * 범위 파라미터 표기는 {@link #rangeParam} 한 곳에서만 만든다. FE1 통보가 오면 거기만 바꾼다.
	 */
	@GetMapping("/major")
	public ApiResponse<MajorResponse> major(
			@RequestParam(defaultValue = "1") @Min(1) int level,
			@RequestParam Map<String, String> params) {
		return ApiResponse.success(musicService.getMajor(level, accumulatedBoxes(level, params)));
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
	 * 노래 검색 (정본 §3.1). query 부분일치, page 0-based. 결과 없음은 빈 content + 200.
	 */
	@GetMapping("/search")
	public ApiResponse<PageResponse<MusicSummary>> search(
			@RequestParam @NotBlank String query,
			@RequestParam @Min(0) int page) {
		return ApiResponse.success(musicService.search(query, page));
	}

	/**
	 * 노래 상세 조회 (정본 §3.2). id로 상세 + 최근접 10곡(neighbors). 없는 곡 → 404 MUSIC_NOT_FOUND.
	 */
	@GetMapping("/detail")
	public ApiResponse<MusicDetailResponse> detail(@RequestParam @Min(1) long id) {
		return ApiResponse.success(musicService.getDetail(id));
	}
}
