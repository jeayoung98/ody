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
import com.ssafy.backend.playlist.dto.PlaylistCreateRequest;
import com.ssafy.backend.playlist.dto.PlaylistCreateResponse;
import com.ssafy.backend.playlist.dto.PlaylistDetailResponse;
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

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/playlist")
@Validated
@RequiredArgsConstructor
public class PlaylistController {

	private final PlaylistService playlistService;

	/** 플레이리스트 목록 조회 (정본 §4.1). 본인 목록도 이 API(email에 본인 email). */
	@GetMapping("/search")
	public ApiResponse<PlaylistSearchResponse> search(
			@RequestParam @NotBlank String email, Authentication authentication) {
		return ApiResponse.success(
				new PlaylistSearchResponse(playlistService.search(email, authentication.getName())));
	}

	/** 플레이리스트 상세 조회 (정본 §4.2). 소유자만 접근 가능. */
	@GetMapping("/detail")
	public ApiResponse<PlaylistDetailResponse> detail(
			@RequestParam @Min(1) long playlistId, Authentication authentication) {
		return ApiResponse.success(playlistService.getDetail(playlistId, authentication.getName()));
	}

	/** 플레이리스트 생성 (정본 §4.3). 소유자는 토큰 주체. */
	@PostMapping("/create")
	public ResponseEntity<ApiResponse<PlaylistCreateResponse>> create(
			@RequestBody @Valid PlaylistCreateRequest request, Authentication authentication) {
		PlaylistCreateResponse response =
				playlistService.create(authentication.getName(), request.playlistName(), request.musicIdList());
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
	}

	/** 기존 플레이리스트에 곡 추가 (정본 §4.4). */
	@PostMapping("/music/insert")
	public ApiResponse<PlaylistMusicInsertResponse> insertMusic(
			@RequestBody @Valid PlaylistMusicInsertRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.insertMusic(
				request.playlistId(), request.musicIdList(), authentication.getName()));
	}

	/** 플레이리스트에서 곡 삭제 (정본 §4.5). */
	@PostMapping("/music/delete")
	public ApiResponse<PlaylistMusicDeleteResponse> deleteMusic(
			@RequestBody @Valid PlaylistMusicDeleteRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.deleteMusic(
				request.playlistId(), request.musicIdList(), authentication.getName()));
	}

	/** 플레이리스트 곡 순서 변경 (S15P21A405-66, 정본 §4에는 없는 신규 엔드포인트). */
	@PostMapping("/music/reorder")
	public ApiResponse<PlaylistMusicReorderResponse> reorderMusic(
			@RequestBody @Valid PlaylistMusicReorderRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.reorderMusic(
				request.playlistId(), request.musicIdList(), authentication.getName()));
	}

	/** 플레이리스트 이름 변경 (정본 §4.6). */
	@PatchMapping("/update")
	public ApiResponse<PlaylistUpdateResponse> update(
			@RequestBody @Valid PlaylistUpdateRequest request, Authentication authentication) {
		return ApiResponse.success(playlistService.update(
				request.playlistId(), request.playlistName(), authentication.getName()));
	}

	/** 플레이리스트 삭제 (정본 §4.7). */
	@DeleteMapping("/delete/{playlistId}")
	public ApiResponse<Void> delete(@PathVariable @Min(1) long playlistId, Authentication authentication) {
		playlistService.delete(playlistId, authentication.getName());
		return ApiResponse.success(null);
	}
}
