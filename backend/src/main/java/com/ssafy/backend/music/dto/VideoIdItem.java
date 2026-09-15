package com.ssafy.backend.music.dto;

/** musicId 별 videoId (S15P21A405-322). 못 찾았거나 확보 실패면 videoId 는 null. */
public record VideoIdItem(Long musicId, String videoId) {
}
