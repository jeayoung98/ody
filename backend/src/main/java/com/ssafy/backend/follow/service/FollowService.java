package com.ssafy.backend.follow.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.follow.dto.FollowListResponse;
import com.ssafy.backend.follow.dto.FollowRequest;
import com.ssafy.backend.follow.dto.FollowResponse;
import com.ssafy.backend.follow.dto.FollowType;
import com.ssafy.backend.follow.dto.FollowUserRow;
import com.ssafy.backend.follow.dto.FollowUserSummary;
import com.ssafy.backend.follow.mapper.FollowMapper;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 팔로우 등록·해제·목록 조회 (api-spec §2.5~§2.8, S15P21A405-433).
 *
 * 팔로우를 거는 쪽은 언제나 토큰 주체다 — 요청 본문으로 받지 않는다.
 * 목록의 isFollowing 과 meetingCnt 도 목록 소유자가 아니라 토큰 주체 기준이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FollowService {

	/** 목록 한 페이지 크기 (api-spec §0.3, 서버 고정). */
	public static final int PAGE_SIZE = 20;

	private final FollowMapper followMapper;
	private final UserMapper userMapper;

	/**
	 * 팔로우 등록. 자기 자신·없는 사용자·이미 팔로우한 상대는 각각 다른 오류다.
	 */
	@Transactional
	public FollowResponse follow(String followerEmail, FollowRequest request) {
		String followeeEmail = request == null ? null : request.followeeEmail();
		if (followeeEmail == null || followeeEmail.isBlank()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		if (followerEmail.equals(followeeEmail)) {
			throw new CustomException(UserErrorCode.SELF_FOLLOW_NOT_ALLOWED);
		}
		requireUser(followeeEmail);

		if (followMapper.exists(followerEmail, followeeEmail)) {
			throw new CustomException(UserErrorCode.ALREADY_FOLLOWING);
		}

		followMapper.insert(followerEmail, followeeEmail);

		log.info("[Follow] 팔로우 등록 완료 followee={}", followeeEmail);
		return new FollowResponse(followerEmail, followeeEmail, true, followMapper.countFollowers(followeeEmail));
	}

	/**
	 * 팔로우 해제. 팔로우 중이 아니어도 200 이다(멱등, api-spec §2.6) — 버튼을 두 번 눌러도
	 * 화면이 오류로 깨지지 않아야 한다.
	 */
	@Transactional
	public FollowResponse unfollow(String followerEmail, FollowRequest request) {
		String followeeEmail = request == null ? null : request.followeeEmail();
		if (followeeEmail == null || followeeEmail.isBlank()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		requireUser(followeeEmail);

		followMapper.delete(followerEmail, followeeEmail);

		log.info("[Follow] 팔로우 해제 완료 followee={}", followeeEmail);
		return new FollowResponse(followerEmail, followeeEmail, false, followMapper.countFollowers(followeeEmail));
	}

	/**
	 * 팔로워·팔로잉 목록. 대상이 비공개이고 본인이 아니면 상세 조회와 같은 기준으로 막는다.
	 *
	 * hasNext 는 한 건 더 떠보고 판단한다 — 총 건수를 세지 않는다(PageResponse 의 결정과 같다).
	 */
	public FollowListResponse list(String targetEmail, String rawType, Integer rawPage, String requesterEmail) {
		if (targetEmail == null || targetEmail.isBlank()) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		FollowType type = FollowType.from(rawType);
		if (type == null) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}
		int page = rawPage == null ? 0 : rawPage;
		if (page < 0) {
			throw new CustomException(GlobalErrorCode.INVALID_INPUT);
		}

		UserProfileRow target = requireUser(targetEmail);
		if (!target.isPublic() && !targetEmail.equals(requesterEmail)) {
			throw new CustomException(UserErrorCode.USER_PRIVATE);
		}

		int offset = page * PAGE_SIZE;
		int limit = PAGE_SIZE + 1;
		List<FollowUserRow> rows = type == FollowType.FOLLOWER
				? followMapper.findFollowers(targetEmail, requesterEmail, limit, offset)
				: followMapper.findFollowings(targetEmail, requesterEmail, limit, offset);

		boolean hasNext = rows.size() > PAGE_SIZE;
		List<FollowUserSummary> content = rows.stream()
				.limit(PAGE_SIZE)
				.map(FollowService::toSummary)
				.toList();

		log.info("[Follow] 목록 조회 완료 targetEmail={} type={} page={} size={}",
				targetEmail, type.toParam(), page, content.size());
		return new FollowListResponse(type.toParam(), content, page, PAGE_SIZE, hasNext);
	}

	/** 상세 조회(UserService)가 쓰는 팔로워 수. */
	public int countFollowers(String email) {
		return followMapper.countFollowers(email);
	}

	/** 상세 조회(UserService)가 쓰는 팔로잉 수. */
	public int countFollowings(String email) {
		return followMapper.countFollowings(email);
	}

	/** 상세 조회(UserService)가 쓰는 "요청자가 대상을 팔로우 중인지". */
	public boolean isFollowing(String followerEmail, String followeeEmail) {
		return followMapper.exists(followerEmail, followeeEmail);
	}

	private UserProfileRow requireUser(String email) {
		UserProfileRow row = userMapper.findProfileByEmail(email);
		if (row == null) {
			throw new CustomException(UserErrorCode.USER_NOT_FOUND);
		}
		return row;
	}

	private static FollowUserSummary toSummary(FollowUserRow row) {
		return new FollowUserSummary(
				row.getEmail(),
				row.getName(),
				row.getNickname(),
				row.getImageUrl(),
				row.isPublic(),
				row.isFollowing(),
				row.getLastActiveAt(),
				row.getMeetingCnt());
	}
}
