package com.ssafy.backend.user.dto;

import java.time.OffsetDateTime;

import com.ssafy.backend.music.dto.MusicDetail;

/**
 * /user/detail 응답 (정본 §2.1, tutorialCompleted 필드로 lastMusic 대체).
 * 본인 조회 시 isMe=true. followerCnt/followingCnt/isFollowing은 팔로우 MVP(E1) 확정 전까지
 * 0/false 고정 placeholder (S15P21A405-70 이슈 설명 참고).
 *
 * playedMusicCnt 는 그 사용자가 재생한 곡 수이고 같은 곡을 여러 번 들어도 1곡이다 (S15P21A405-430).
 *
 * discoveredMusicCnt 는 그 사용자가 서비스에서 처음 재생한 곡 수다 (S15P21A405-597). 이미 남이 들은 곡은
 * 그 사용자가 들어도 세지 않는다. 출처는 주간 발견왕과 같은 music_discovery 다.
 *
 * isOnline 은 지금 접속해 있는지다. 소켓이 살아 있으면 true 이고, 창을 닫으면 늦어도
 * 45초 뒤에 false 가 된다. lastActiveAt 으로 짐작하지 않아도 된다 — 그 값은 로그인 시각이라
 * 접속과 상관이 없다. 실시간 기능을 켜지 않은 사람은 접속해 있어도 false 다.
 *
 * lastMusic 은 그 사용자가 마지막으로 재생한 곡이다 (S15P21A405-713). 곡 상세·좋아요 목록과 같은
 * MusicDetail 모양이라 같은 컴포넌트로 그리고 albumMbid 로 커버를 연다. 재생 기록이 없으면 null 이다.
 */
public record UserDetailResponse(
		String email,
		String name,
		String nickname,
		boolean isPublic,
		boolean tutorialCompleted,
		OffsetDateTime lastActiveAt,
		OffsetDateTime createdAt,
		String imageUrl,
		int followerCnt,
		int followingCnt,
		boolean isFollowing,
		boolean isMe,
		int playedMusicCnt,
		int discoveredMusicCnt,
		boolean isOnline,
		MusicDetail lastMusic) {
}
