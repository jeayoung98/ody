package com.ssafy.backend.artwork.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.artwork.dto.ArtworkDetailResponse;
import com.ssafy.backend.artwork.dto.ArtworkLeaderboardResponse;
import com.ssafy.backend.artwork.dto.CatPlaylistRequest;
import com.ssafy.backend.artwork.dto.CatPlaylistResponse;
import com.ssafy.backend.artwork.dto.CatTemplateSummary;
import com.ssafy.backend.artwork.service.CatPlaylistGenerator;
import com.ssafy.backend.artwork.dto.ArtworkLikeRequest;
import com.ssafy.backend.artwork.dto.ArtworkLikeResponse;
import com.ssafy.backend.artwork.dto.ArtworkRound;
import com.ssafy.backend.artwork.dto.ArtworkSubmitRequest;
import com.ssafy.backend.artwork.dto.ArtworkSubmitResponse;
import com.ssafy.backend.artwork.dto.ArtworkSummary;
import com.ssafy.backend.artwork.service.ArtworkService;
import com.ssafy.backend.common.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;

import lombok.RequiredArgsConstructor;

/**
 * 별자리 작품 AI 평가·회차 리더보드 (S15P21A405-563).
 *
 * <p>조회 계열은 비로그인도 볼 수 있다 — {@code Authentication} 이 null 일 수 있으므로 주체를
 * 직접 꺼내지 않고 {@link #emailOrNull} 로 감싼다.
 */
@RestController
@RequestMapping("/api/artwork")
@Validated
@RequiredArgsConstructor
@Tag(name = "Artwork", description = "별자리 작품 제출·AI 평가·회차 리더보드")
public class ArtworkController {

	private final ArtworkService artworkService;
	private final CatPlaylistGenerator catPlaylistGenerator;

	/** 재시도 상한. 사용자당 GMS 호출 수를 묶는 값이기도 하다. */
	@Value("${ody.artwork.evaluation.max-attempts:3}")
	private int maxAttempts;

	/** 지금 열린 회차. 없으면 data 가 null 이다(오류가 아니다). */
	@Operation(summary = "현재 회차 조회", description = "지금 열려 있는 회차를 반환한다. 없으면 data 가 null 이다.")
	@GetMapping("/round/current")
	public ApiResponse<ArtworkRound> currentRound() {
		return ApiResponse.success(artworkService.findOpenRound().orElse(null));
	}

	/**
	 * 플레이리스트를 작품으로 제출한다. 응답은 언제나 {@code PENDING} 이고 평가를 기다리지 않는다 —
	 * 점수는 프론트가 상세를 다시 조회해 확인한다.
	 */
	@Operation(summary = "작품 제출",
			description = "내 플레이리스트를 지금 열린 회차의 작품으로 제출한다. 평가는 뒤에서 진행되며 응답은 PENDING 이다. "
					+ "같은 회차에 이미 낸 작품이 있으면 지우고 새로 만든다(점수·좋아요는 사라진다).")
	@PostMapping("/submit")
	public ResponseEntity<ApiResponse<ArtworkSubmitResponse>> submit(
			@RequestBody @Valid ArtworkSubmitRequest request, Authentication authentication) {
		ArtworkSubmitResponse response = artworkService.submit(request.playlistId(), authentication.getName());
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
	}

	/** 고양이 템플릿 목록. {@code pointCount} 가 생성될 플레이리스트의 곡 수다. */
	@Operation(summary = "고양이 템플릿 목록", description = "생성 가능한 고양이 모양 템플릿을 반환한다. name 을 /generate 에 넘긴다.")
	@GetMapping("/templates")
	public ApiResponse<List<CatTemplateSummary>> templates() {
		return ApiResponse.success(catPlaylistGenerator.templates());
	}

	/**
	 * 템플릿 모양대로 곡을 골라 내 플레이리스트를 만든다. 제출은 하지 않는다 — 사용자가 보고 {@code /submit}.
	 * 응답 {@code points} 는 배치 API 가 그 플레이리스트에 돌려주는 값과 같다.
	 */
	@Operation(summary = "고양이 플레이리스트 생성",
			description = "템플릿의 점마다 pc1/pc2 평면에서 가장 가까운 곡을 골라 내 플레이리스트를 만든다. "
					+ "제출은 하지 않는다. fitError 는 템플릿과 실제 곡 위치의 평균 어긋남(0 이 완벽)이다.")
	@PostMapping("/generate")
	public ResponseEntity<ApiResponse<CatPlaylistResponse>> generate(
			@RequestBody @Valid CatPlaylistRequest request, Authentication authentication) {
		CatPlaylistResponse response = catPlaylistGenerator.generate(request.template(), authentication.getName());
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
	}

	/** 회차 리더보드. 점수 내림차순 → 좋아요 내림차순 → 먼저 제출한 순. 채점된 작품만 보인다. */
	@Operation(summary = "리더보드 조회",
			description = "회차의 작품을 점수 내림차순으로 반환한다. roundId 를 생략하면 지금 열린 회차다. 채점된 작품만 보인다.")
	@GetMapping("/leaderboard")
	public ApiResponse<ArtworkLeaderboardResponse> leaderboard(
			@RequestParam(required = false) Long roundId,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size,
			Authentication authentication) {
		return ApiResponse.success(
				artworkService.getLeaderboard(roundId, emailOrNull(authentication), page, size));
	}

	/** 작품 상세. 아직 점수가 없는 작품은 소유자에게만 보인다. */
	@Operation(summary = "작품 상세 조회",
			description = "좌표·곡 목록·점수·한 줄 평을 반환한다. 아직 점수가 없는 작품은 소유자에게만 보인다.")
	@GetMapping("/detail")
	public ApiResponse<ArtworkDetailResponse> detail(
			@RequestParam @Min(1) long artworkId, Authentication authentication) {
		return ApiResponse.success(artworkService.getDetail(artworkId, emailOrNull(authentication)));
	}

	/** 내 작품. 평가 전·실패도 함께 보인다. */
	@Operation(summary = "내 작품 목록 조회", description = "내가 낸 작품을 최근 제출 순으로 반환한다. 평가 전·실패 작품도 포함한다.")
	@GetMapping("/mine")
	public ApiResponse<List<ArtworkSummary>> mine(Authentication authentication) {
		return ApiResponse.success(artworkService.findMine(authentication.getName()));
	}

	/** 좋아요 변경. liked 는 토글이 아니라 목표 상태라 같은 요청을 반복해도 결과가 같다. */
	@Operation(summary = "작품 좋아요 변경",
			description = "liked=true 면 좋아요를 누르고 false 면 해제한다. 같은 요청을 반복해도 결과가 같다.")
	@PostMapping("/like")
	public ApiResponse<ArtworkLikeResponse> changeLike(
			@RequestBody @Valid ArtworkLikeRequest request, Authentication authentication) {
		return ApiResponse.success(artworkService.changeLike(request, authentication.getName()));
	}

	/** 실패한 작품 재평가. 소유자만, 실패 상태만, 상한까지만. */
	@Operation(summary = "작품 재평가 요청",
			description = "평가에 실패한 내 작품을 다시 평가 대기로 돌린다. 재시도 횟수를 모두 쓰면 거부한다.")
	@PostMapping("/retry/{artworkId}")
	public ApiResponse<Void> retry(@PathVariable @Min(1) long artworkId, Authentication authentication) {
		artworkService.retry(artworkId, authentication.getName(), maxAttempts);
		return ApiResponse.success(null);
	}

	/** 작품 삭제. 좌표·좋아요도 함께 사라진다. */
	@Operation(summary = "작품 삭제", description = "내 작품을 삭제한다. 좌표와 좋아요 기록도 함께 삭제된다.")
	@DeleteMapping("/{artworkId}")
	public ApiResponse<Void> delete(@PathVariable @Min(1) long artworkId, Authentication authentication) {
		artworkService.delete(artworkId, authentication.getName());
		return ApiResponse.success(null);
	}

	private static String emailOrNull(Authentication authentication) {
		return authentication == null ? null : authentication.getName();
	}
}
