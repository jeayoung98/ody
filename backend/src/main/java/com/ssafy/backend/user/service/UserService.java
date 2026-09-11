package com.ssafy.backend.user.service;

import org.springframework.stereotype.Service;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.dto.UserDetailResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

	private final UserMapper userMapper;

	/**
	 * 사용자 상세 조회 (정본 §2.1). 본인 조회도 이 API(email == 토큰 주체 → isMe:true).
	 * 비공개 사용자 + 본인 아님 → USER_PRIVATE. 없는 사용자 → USER_NOT_FOUND.
	 *
	 * ponytail: followerCnt/followingCnt/isFollowing은 팔로우 MVP 범위 확정(E1) 전까지
	 * 0/false 고정. 팔로우 기능 착수 시 실제 집계로 교체한다(S15P21A405-70 이슈 설명).
	 */
	public UserDetailResponse getDetail(String targetEmail, String requesterEmail) {
		UserProfileRow row = userMapper.findProfileByEmail(targetEmail);
		if (row == null) {
			throw new CustomException(UserErrorCode.USER_NOT_FOUND);
		}

		boolean isMe = targetEmail.equals(requesterEmail);
		if (!row.isPublic() && !isMe) {
			throw new CustomException(UserErrorCode.USER_PRIVATE);
		}

		return new UserDetailResponse(
				row.getEmail(),
				row.getName(),
				row.getNickname(),
				row.isPublic(),
				row.isTutorialCompleted(),
				row.getLastActiveAt(),
				row.getCreatedAt(),
				row.getImageUrl(),
				0,
				0,
				false,
				isMe);
	}

	/**
	 * 온보딩(지도 튜토리얼) 완료 처리 (S15P21A405-122). 토큰 주체 본인만 대상, email 파라미터 없음.
	 */
	public void completeTutorial(String email) {
		userMapper.updateTutorialCompleted(email);
	}
}
