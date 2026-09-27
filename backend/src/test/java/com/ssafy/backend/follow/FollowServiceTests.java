package com.ssafy.backend.follow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.GlobalErrorCode;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.follow.dto.FollowListResponse;
import com.ssafy.backend.follow.dto.FollowRequest;
import com.ssafy.backend.follow.dto.FollowResponse;
import com.ssafy.backend.follow.dto.FollowUserRow;
import com.ssafy.backend.follow.dto.FollowUserSummary;
import com.ssafy.backend.follow.mapper.FollowMapper;
import com.ssafy.backend.presence.OnlineStatusService;
import com.ssafy.backend.follow.service.FollowService;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;

/**
 * 팔로우 서비스 유닛 (S15P21A405-433). 만난 횟수의 사전순 양방향 조회는 SQL 쪽 책임이라
 * 여기서는 매퍼에 넘기는 값과 분기·오류만 본다.
 */
class FollowServiceTests {

	private final FollowMapper followMapper = mock(FollowMapper.class);
	private final UserMapper userMapper = mock(UserMapper.class);
	private final OnlineStatusService onlineStatusService = mock(OnlineStatusService.class);
	private final FollowService followService = new FollowService(followMapper, userMapper, onlineStatusService);

	/** 목록에 오르는 사람 수만큼 왕복이 생기면 그대로 지연이 된다. 한 번에 묶어 물어야 한다. */
	@Test
	void list_asksOnlineOnceForWholePage() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		when(followMapper.findFollowings(anyString(), anyString(), anyInt(), anyInt()))
				.thenReturn(List.of(followRow("a@gmail.com", 0), followRow("b@gmail.com", 0)));
		when(onlineStatusService.onlineOf(List.of("a@gmail.com", "b@gmail.com")))
				.thenReturn(Map.of("a@gmail.com", true));

		FollowListResponse result = followService.list("you@gmail.com", "following", 0, "me@gmail.com");

		assertThat(result.content())
				.extracting(FollowUserSummary::email, FollowUserSummary::isOnline)
				.containsExactly(tuple("a@gmail.com", true), tuple("b@gmail.com", false));
		verify(onlineStatusService, times(1)).onlineOf(anyList());
		verify(onlineStatusService, never()).isOnline(anyString());
	}

	private static UserProfileRow user(boolean isPublic) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("you@gmail.com");
		row.setIsPublic(isPublic);
		return row;
	}

	private static FollowUserRow followRow(String email, int meetingCnt) {
		FollowUserRow row = new FollowUserRow();
		row.setEmail(email);
		row.setName("김철수");
		row.setImageUrl("https://cdn.example.com/a.png");
		row.setIsPublic(true);
		row.setMeetingCnt(meetingCnt);
		row.setFollowing(true);
		return row;
	}

	@Test
	void follow_newFollowee_insertsAndReturnsUpdatedCount() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		when(followMapper.exists("me@gmail.com", "you@gmail.com")).thenReturn(false);
		when(followMapper.countFollowers("you@gmail.com")).thenReturn(13);

		FollowResponse result = followService.follow("me@gmail.com", new FollowRequest("you@gmail.com"));

		assertThat(result.isFollowing()).isTrue();
		assertThat(result.followerEmail()).isEqualTo("me@gmail.com");
		assertThat(result.followeeFollowerCnt()).isEqualTo(13);
		verify(followMapper).insert("me@gmail.com", "you@gmail.com");
	}

	@Test
	void follow_self_throwsSelfFollowNotAllowed() {
		assertThatThrownBy(() -> followService.follow("me@gmail.com", new FollowRequest("me@gmail.com")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.SELF_FOLLOW_NOT_ALLOWED);

		verify(followMapper, never()).insert(anyString(), anyString());
	}

	@Test
	void follow_unknownUser_throwsUserNotFound() {
		when(userMapper.findProfileByEmail("ghost@gmail.com")).thenReturn(null);

		assertThatThrownBy(() -> followService.follow("me@gmail.com", new FollowRequest("ghost@gmail.com")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);
	}

	@Test
	void follow_alreadyFollowing_throwsAlreadyFollowing() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		when(followMapper.exists("me@gmail.com", "you@gmail.com")).thenReturn(true);

		assertThatThrownBy(() -> followService.follow("me@gmail.com", new FollowRequest("you@gmail.com")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.ALREADY_FOLLOWING);

		verify(followMapper, never()).insert(anyString(), anyString());
	}

	@Test
	void follow_blankFollowee_throwsInvalidInput() {
		assertThatThrownBy(() -> followService.follow("me@gmail.com", new FollowRequest("  ")))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);
	}

	@Test
	void unfollow_notFollowing_stillSucceeds() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		when(followMapper.countFollowers("you@gmail.com")).thenReturn(12);

		FollowResponse result = followService.unfollow("me@gmail.com", new FollowRequest("you@gmail.com"));

		assertThat(result.isFollowing()).isFalse();
		assertThat(result.followeeFollowerCnt()).isEqualTo(12);
		verify(followMapper).delete("me@gmail.com", "you@gmail.com");
	}

	@Test
	void list_follower_usesFollowerQueryAndRequesterAsMeetingBase() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		when(followMapper.findFollowers("you@gmail.com", "me@gmail.com", FollowService.PAGE_SIZE + 1, 0))
				.thenReturn(List.of(followRow("a@gmail.com", 7)));

		FollowListResponse result = followService.list("you@gmail.com", "follower", 0, "me@gmail.com");

		assertThat(result.type()).isEqualTo("follower");
		assertThat(result.content()).hasSize(1);
		assertThat(result.content().get(0).meetingCnt()).isEqualTo(7);
		assertThat(result.content().get(0).isFollowing()).isTrue();
		assertThat(result.hasNext()).isFalse();
		verify(followMapper, never()).findFollowings(anyString(), anyString(), anyInt(), anyInt());
	}

	@Test
	void list_following_usesFollowingQuery() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		when(followMapper.findFollowings("you@gmail.com", "me@gmail.com", FollowService.PAGE_SIZE + 1, 0))
				.thenReturn(List.of(followRow("a@gmail.com", 0)));

		FollowListResponse result = followService.list("you@gmail.com", "FOLLOWING", 0, "me@gmail.com");

		assertThat(result.type()).isEqualTo("following");
		assertThat(result.content().get(0).meetingCnt()).isZero();
		verify(followMapper, never()).findFollowers(anyString(), anyString(), anyInt(), anyInt());
	}

	@Test
	void list_secondPage_appliesOffsetAndTrimsExtraRow() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(true));
		List<FollowUserRow> rows = new ArrayList<>();
		for (int i = 0; i < FollowService.PAGE_SIZE + 1; i++) {
			rows.add(followRow("user" + i + "@gmail.com", i));
		}
		when(followMapper.findFollowings("you@gmail.com", "me@gmail.com",
				FollowService.PAGE_SIZE + 1, FollowService.PAGE_SIZE)).thenReturn(rows);

		FollowListResponse result = followService.list("you@gmail.com", "following", 1, "me@gmail.com");

		assertThat(result.page()).isEqualTo(1);
		assertThat(result.size()).isEqualTo(FollowService.PAGE_SIZE);
		assertThat(result.content()).hasSize(FollowService.PAGE_SIZE);
		assertThat(result.hasNext()).isTrue();
	}

	@Test
	void list_unknownType_throwsInvalidInput() {
		assertThatThrownBy(() -> followService.list("you@gmail.com", "friends", 0, "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(GlobalErrorCode.INVALID_INPUT);

		verify(userMapper, never()).findProfileByEmail(any());
	}

	@Test
	void list_privateOtherUser_throwsUserPrivate() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(false));

		assertThatThrownBy(() -> followService.list("you@gmail.com", "follower", 0, "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_PRIVATE);
	}

	@Test
	void list_privateSelf_isAllowed() {
		when(userMapper.findProfileByEmail("you@gmail.com")).thenReturn(user(false));
		when(followMapper.findFollowers("you@gmail.com", "you@gmail.com", FollowService.PAGE_SIZE + 1, 0))
				.thenReturn(List.of());

		FollowListResponse result = followService.list("you@gmail.com", "follower", 0, "you@gmail.com");

		assertThat(result.content()).isEmpty();
		assertThat(result.hasNext()).isFalse();
	}
}
