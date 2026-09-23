package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.follow.service.FollowService;
import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.presence.OfflineOnlyStatusService;
import com.ssafy.backend.presence.OnlineStatusService;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.dto.UserDetailResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.UserService;

/**
 * 사용자 상세 서비스 유닛 (mock mapper). 조립·본인/타인 분기·404/403 전환을 검증한다.
 * followerCnt/followingCnt/isFollowing 은 FollowService 집계다 (S15P21A405-433) —
 * 이전의 0/0/false 고정 placeholder 는 없어졌다.
 */
class UserDetailServiceTests {

	/** 접속 여부를 보지 않는 시험은 이걸 쓴다. 늘 접속 안 함으로 답한다. */
	private final OnlineStatusService online = new OfflineOnlyStatusService();

	private static UserProfileRow row(boolean isPublic) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("you@gmail.com");
		row.setName("김철수");
		row.setNickname("철수형");
		row.setImageUrl("https://cdn.example.com/profile/abc.png");
		row.setIsPublic(isPublic);
		row.setTutorialCompleted(true);
		row.setLastActiveAt(OffsetDateTime.parse("2026-09-07T13:41:02+09:00"));
		row.setCreatedAt(OffsetDateTime.parse("2026-08-21T09:12:44+09:00"));
		return row;
	}

	@Test
	void getDetail_otherPublicUser_returnsDetailWithIsMeFalse() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		UserDetailResponse result = service.getDetail("you@gmail.com", "me@gmail.com");

		assertThat(result.email()).isEqualTo("you@gmail.com");
		assertThat(result.tutorialCompleted()).isTrue();
		assertThat(result.isPublic()).isTrue();
		assertThat(result.isMe()).isFalse();
	}

	/** 화면이 마지막 활동 시각으로 짐작하던 값이다. 서버가 아는 값을 그대로 내려준다. */
	@Test
	void getDetail_tellsWhetherTargetIsOnline() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		OnlineStatusService onlineStatusService = Mockito.mock(OnlineStatusService.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		when(onlineStatusService.isOnline("you@gmail.com")).thenReturn(true);
		UserService service = new UserService(
				mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), onlineStatusService);

		assertThat(service.getDetail("you@gmail.com", "me@gmail.com").isOnline()).isTrue();
	}

	/** 실시간을 켜지 않은 구성에서는 알 길이 없다. 그때도 상세는 떠야 한다. */
	@Test
	void getDetail_isOfflineWhenPresenceIsUnknown() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		UserService service = new UserService(
				mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		assertThat(service.getDetail("you@gmail.com", "me@gmail.com").isOnline()).isFalse();
	}

	@Test
	void getDetail_usesRealFollowCounts() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		FollowService followService = Mockito.mock(FollowService.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		when(followService.countFollowers("you@gmail.com")).thenReturn(12);
		when(followService.countFollowings("you@gmail.com")).thenReturn(8);
		when(followService.isFollowing("me@gmail.com", "you@gmail.com")).thenReturn(true);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), followService, online);

		UserDetailResponse result = service.getDetail("you@gmail.com", "me@gmail.com");

		assertThat(result.followerCnt()).isEqualTo(12);
		assertThat(result.followingCnt()).isEqualTo(8);
		assertThat(result.isFollowing()).isTrue();
	}

	@Test
	void getDetail_self_isFollowingIsAlwaysFalse() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		FollowService followService = Mockito.mock(FollowService.class);
		when(mapper.findProfileByEmail("me@gmail.com")).thenReturn(row(true));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), followService, online);

		UserDetailResponse result = service.getDetail("me@gmail.com", "me@gmail.com");

		assertThat(result.isFollowing()).isFalse();
		Mockito.verify(followService, Mockito.never()).isFollowing(Mockito.anyString(), Mockito.anyString());
	}

	@Test
	void getDetail_countsDistinctPlayedMusic() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		when(mapper.countDistinctPlayedMusic("you@gmail.com")).thenReturn(42);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		UserDetailResponse result = service.getDetail("you@gmail.com", "me@gmail.com");

		assertThat(result.playedMusicCnt()).isEqualTo(42);
	}

	@Test
	void getDetail_noPlayHistory_returnsZero() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		when(mapper.countDistinctPlayedMusic("you@gmail.com")).thenReturn(0);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		assertThat(service.getDetail("you@gmail.com", "me@gmail.com").playedMusicCnt()).isZero();
	}

	@Test
	void getDetail_privateOtherUser_doesNotCountPlayHistory() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(false));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		assertThatThrownBy(() -> service.getDetail("you@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class);

		Mockito.verify(mapper, Mockito.never()).countDistinctPlayedMusic("you@gmail.com");
		Mockito.verify(mapper, Mockito.never()).countDiscoveredMusic("you@gmail.com");
	}

	@Test
	void getDetail_countsDiscoveredMusic() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		when(mapper.countDistinctPlayedMusic("you@gmail.com")).thenReturn(42);
		when(mapper.countDiscoveredMusic("you@gmail.com")).thenReturn(7);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		UserDetailResponse result = service.getDetail("you@gmail.com", "me@gmail.com");

		assertThat(result.discoveredMusicCnt()).isEqualTo(7);
		assertThat(result.playedMusicCnt()).isEqualTo(42);
	}

	/** 들은 곡이 전부 남이 먼저 들은 곡이면 발견 기록이 없다. 그때도 상세는 0 으로 뜬다. */
	@Test
	void getDetail_noDiscovery_returnsZero() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(true));
		when(mapper.countDiscoveredMusic("you@gmail.com")).thenReturn(0);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		assertThat(service.getDetail("you@gmail.com", "me@gmail.com").discoveredMusicCnt()).isZero();
	}

	@Test
	void getDetail_selfPrivateUser_returnsDetailWithIsMeTrue() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(false));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		UserDetailResponse result = service.getDetail("you@gmail.com", "you@gmail.com");

		assertThat(result.isMe()).isTrue();
		assertThat(result.isPublic()).isFalse();
	}

	@Test
	void getDetail_otherPrivateUser_throwsUserPrivate() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("you@gmail.com")).thenReturn(row(false));
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		assertThatThrownBy(() -> service.getDetail("you@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_PRIVATE);
	}

	@Test
	void getDetail_notFound_throwsUserNotFound() {
		UserMapper mapper = Mockito.mock(UserMapper.class);
		when(mapper.findProfileByEmail("nobody@gmail.com")).thenReturn(null);
		UserService service = new UserService(mapper, Mockito.mock(AuthMapper.class), Mockito.mock(FollowService.class), online);

		assertThatThrownBy(() -> service.getDetail("nobody@gmail.com", "me@gmail.com"))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);
	}
}
