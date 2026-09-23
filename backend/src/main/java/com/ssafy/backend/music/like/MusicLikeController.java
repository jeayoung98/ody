package com.ssafy.backend.music.like;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.backend.common.ApiResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
public class MusicLikeController {

    private final MusicLikeService service;

    @PostMapping("/like")
    public ApiResponse<MusicLikeResponse> change(
            @RequestBody @Valid MusicLikeRequest request, Authentication authentication) {
        return ApiResponse.success(service.change(request, authentication.getName()));
    }

    @GetMapping("/liked")
    public ApiResponse<LikedMusicResponse> findAll(Authentication authentication) {
        return ApiResponse.success(service.findAll(authentication.getName()));
    }
}
