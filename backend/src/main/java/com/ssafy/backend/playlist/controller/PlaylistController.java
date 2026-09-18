package com.ssafy.backend.playlist.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.playlist.dto.LikedPlaylistSearchResponse;
import com.ssafy.backend.playlist.dto.PlaylistCreateRequest;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
import com.ssafy.backend.playlist.dto.PlaylistLikeRequest;
import com.ssafy.backend.playlist.dto.PlaylistLikeResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicDeleteRequest;
import com.ssafy.backend.playlist.dto.PlaylistMusicDeleteResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicInsertRequest;
import com.ssafy.backend.playlist.dto.PlaylistMusicInsertResponse;
import com.ssafy.backend.playlist.dto.PlaylistMusicReorderRequest;
import com.ssafy.backend.playlist.dto.PlaylistMusicReorderResponse;
import com.ssafy.backend.playlist.dto.PlaylistSearchResponse;
import com.ssafy.backend.playlist.dto.PlaylistUpdateRequest;
import com.ssafy.backend.playlist.dto.PlaylistUpdateResponse;
import com.ssafy.backend.playlist.service.PlaylistService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/playlist")
@Validated
@RequiredArgsConstructor
@Tag(name = "Playlist", description = "플레이리스트 조회·생성·수정")
public class PlaylistController {

	private final PlaylistService playlistService;

	/** 플레이리스트 목록 조회 (정본 §4.1). 본인 목록도 이 API(email에 본인 email). */
	@Operation(summary = "플레이리스트 목록 조회", description = "email로 플레이리스트 목록을 조회한다. 본인 목록 조회도 이 API를 사용한다.")
	@GetMapping("/search")
	public ApiResponse<PlaylistSearchResponse> search(
			@RequestParam @NotBlank String email, Authentication authentication) {
		return ApiResponse.success(
				new PlaylistSearchResponse(playlistService.search(email, authentication.getName())));
	}

	/**
	 * 좋아요한 플레이리스트 목록 조회 (S15P21A405-447). 본인 목록도 이 API(email 에 본인 email).
	 * 공개 범위는 /search 와 같다.
	 */
	@Operation(summary = "좋아요한 플레이리스트 목록 조회",
			description = "email 사용자가 좋아요한 플레이리스트를 최근 누른 순으로 조회한다. 본인 목록 조회도 이 API를 사용한다.")
	@GetMapping("/liked")
	public ApiResponse<LikedPlaylistSearchResponse> searchLiked(
			@RequestParam @NotBlank String email, Authentication authentication) {
		return ApiResponse.success(
				new LikedPlaylistSearchResponse(playlistService.searchLiked(email, authentication.getName())));
	}

	/** 플레이리스트 상세 조회 (정본 §4.2). 소유자만 접근 가능. */
	@Operation(summary = "플레이리스트 상세 조회", description = "playlistId로 플레이리스트 상세를 조회한다. 소유자만 접근할 수 있다.")
	@GetMapping("/detail")
	public ApiResponse<PlaylistDetailResponse> detail(
			@RequestParam @Min(1) long playlistId, Authentication authentication) {
		return ApiResponse.success(playlistService.getDetail(playlistId, authentication.getName()));
	}

	/** 플레이리스트 생성 (정본 §4.3). 소유자는 토큰 주체. */
	@Operation(summary = "플레이리스트 생성", description = "로그인한 사용자 본인 소유로 새 플레이리스트를 생성한다.")
	@PostMapping("/create")
	public ResponseEntity<ApiResponse<PlaylistCreateResponse>> create(
			@RequestBody @Valid PlaylistCreateRequest request, Authentication authentication) {
		PlaylistCreateResponse response =
				playlistService.create(authentication.getName(), request.playlistName(), request.musicIdList());
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
	}

	/** 기존 플레이리스트에 곡 추가 (정본 §4.4). */
	@Operation(summary = "플레이리스트에 곡 추가", description = "기존 플레이리스트에 곡을 추가한다.")
	@PostMapping("/music/insert")
	public ApiResponse<PlaylistMusicInsertResponse> insertMusic(
			@RequestBody @Valid PlaylistMusicInsertRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.insertMusic(
				request.playlistId(), request.musicIdList(), authentication.getName()));
	}

	/** 플레이리스트에서 곡 삭제 (정본 §4.5). */
	@Operation(summary = "플레이리스트에서 곡 삭제", description = "플레이리스트에서 지정한 곡들을 삭제한다.")
	@PostMapping("/music/delete")
	public ApiResponse<PlaylistMusicDeleteResponse> deleteMusic(
			@RequestBody @Valid PlaylistMusicDeleteRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.deleteMusic(
				request.playlistId(), request.musicIdList(), authentication.getName()));
	}

	/** 플레이리스트 곡 순서 변경 (S15P21A405-66, 정본 §4에는 없는 신규 엔드포인트). */
	@Operation(summary = "플레이리스트 곡 순서 변경", description = "플레이리스트에 담긴 곡들의 순서를 변경한다.")
	@PostMapping("/music/reorder")
	public ApiResponse<PlaylistMusicReorderResponse> reorderMusic(
			@RequestBody @Valid PlaylistMusicReorderRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.reorderMusic(
				request.playlistId(), request.musicIdList(), authentication.getName()));
	}

	/** 플레이리스트 이름 변경 (정본 §4.6). */
	@Operation(summary = "플레이리스트 이름 변경", description = "플레이리스트 이름을 변경한다.")
	@PatchMapping("/update")
	public ApiResponse<PlaylistUpdateResponse> update(
			@RequestBody @Valid PlaylistUpdateRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.update(
				request.playlistId(), request.playlistName(), authentication.getName()));
	}

	/**
	 * 플레이리스트 좋아요 변경 (S15P21A405-442). liked=true 면 좋아요, false 면 해제.
	 * 토글이 아니라 목표 상태를 받으므로 같은 요청을 여러 번 보내도 결과가 같다.
	 */
	@Operation(summary = "플레이리스트 좋아요 변경",
			description = "liked=true 면 좋아요를 누르고 false 면 해제한다. 같은 요청을 반복해도 결과가 같다.")
	@PostMapping("/like")
	public ApiResponse<PlaylistLikeResponse> changeLike(
			@RequestBody @Valid PlaylistLikeRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.changeLike(request, authentication.getName()));
	}

	/** 플레이리스트 삭제 (정본 §4.7). */
	@Operation(summary = "플레이리스트 삭제", description = "플레이리스트를 삭제한다.")
	@DeleteMapping("/delete/{playlistId}")
	public ApiResponse<Void> delete(@PathVariable @Min(1) long playlistId, Authentication authentication) {
		playlistService.delete(playlistId, authentication.getName());
		return ApiResponse.success(null);
	}
}
