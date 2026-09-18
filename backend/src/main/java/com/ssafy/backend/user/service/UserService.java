package com.ssafy.backend.user.service;

import org.springframework.stereotype.Service;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.common.AuthErrorCode;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.NicknamePolicy;
import com.ssafy.backend.user.dto.NicknameUpdateRequest;
import com.ssafy.backend.user.dto.NicknameUpdateResponse;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateRequest;
import com.ssafy.backend.user.dto.PublicVisibilityUpdateResponse;
import com.ssafy.backend.user.dto.UserDetailResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

	private final UserMapper userMapper;
	private final AuthMapper authMapper;

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

		// 비공개 판정 뒤에 센다 — 볼 수 없는 사용자의 기록은 읽지 않는다 (S15P21A405-430).
		int playedMusicCnt = userMapper.countDistinctPlayedMusic(targetEmail);

		log.info("[User] 상세 조회 완료 targetEmail={} isMe={}", targetEmail, isMe);
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
				isMe,
				playedMusicCnt);
	}

	/**
	 * 온보딩(지도 튜토리얼) 완료 처리 (S15P21A405-122). 토큰 주체 본인만 대상, email 파라미터 없음.
	 */
	public void completeTutorial(String email) {
		userMapper.updateTutorialCompleted(email);
		log.info("[User] 온보딩 완료 처리 email={}", email);
	}

	/**
	 * 닉네임 수정 (S15P21A405-426, 이전 PATCH /api/user/profile 에서 분리). 토큰 주체 본인만 대상이라
	 * email 파라미터를 받지 않는다. signup 과 같은 길이 규칙·중복 검사를 적용하되, 기존과 동일한 닉네임으로의
	 * "변경"은 중복으로 취급하지 않는다. 프로필 이미지는 ProfileImageService 가 따로 다룬다.
	 */
	public NicknameUpdateResponse updateNickname(String email, NicknameUpdateRequest request) {
		String nickname = request == null ? null : request.nickname();

		if (nickname == null || nickname.isBlank()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		if (!NicknamePolicy.isValidLength(nickname)) {
			throw new CustomException(AuthErrorCode.INVALID_NICKNAME_LENGTH);
		}

		UserProfileRow current = userMapper.findProfileByEmail(email);
		if (current == null) {
			throw new CustomException(UserErrorCode.USER_NOT_FOUND);
		}
		if (!nickname.equals(current.getNickname()) && authMapper.existsByNickname(nickname)) {
			throw new CustomException(AuthErrorCode.NICKNAME_ALREADY_EXISTS);
		}

		userMapper.updateNickname(email, nickname);
		log.info("[User] 닉네임 수정 완료 email={}, nickname={}", email, nickname);
		return new NicknameUpdateResponse(nickname);
	}

	/**
	 * 공개 설정(is_public) 변경 (S15P21A405-300). 토큰 주체 본인만 대상, email 파라미터 없음.
	 */
	public PublicVisibilityUpdateResponse updatePublicVisibility(String email, PublicVisibilityUpdateRequest request) {
		Boolean isPublic = request.isPublic();
		if (isPublic == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}

		userMapper.updateIsPublic(email, isPublic);
		log.info("[User] 공개 설정 변경 완료 email={} isPublic={}", email, isPublic);
		return new PublicVisibilityUpdateResponse(isPublic);
	}
}
