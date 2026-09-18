package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.dto.ProfileImageUpdateResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.image.ProfileImageStorage;
import com.ssafy.backend.user.mapper.UserMapper;
import com.ssafy.backend.user.service.ProfileImageService;

/**
 * 프로필 이미지 교체 유닛 (S15P21A405-426). 파일 저장 자체는 ProfileImageStorageTests 가 검증하고,
 * 여기서는 저장·DB 갱신·이전 파일 삭제의 순서와 실패 시 되돌리기를 본다.
 */
class ProfileImageServiceTests {

	private final UserMapper userMapper = mock(UserMapper.class);
	private final ProfileImageStorage storage = mock(ProfileImageStorage.class);
	private final ProfileImageService profileImageService = new ProfileImageService(userMapper, storage);

	private static final MultipartFile FILE =
			new MockMultipartFile("file", "avatar.png", "image/png", new byte[] { 1, 2, 3 });

	private static UserProfileRow row(String imageUrl) {
		UserProfileRow row = new UserProfileRow();
		row.setEmail("me@gmail.com");
		row.setImageUrl(imageUrl);
		return row;
	}

	@Test
	void updateImage_storesFileThenUpdatesDbThenDeletesPrevious() {
		when(userMapper.findProfileByEmail("me@gmail.com"))
				.thenReturn(row("https://example.test/api/user/images/old.png"));
		when(storage.store(FILE)).thenReturn("https://example.test/api/user/images/new.png");

		ProfileImageUpdateResponse result = profileImageService.updateImage("me@gmail.com", FILE);

		assertThat(result.imageUrl()).isEqualTo("https://example.test/api/user/images/new.png");
		verify(userMapper).updateImageUrl("me@gmail.com", "https://example.test/api/user/images/new.png");
		verify(storage).deleteIfManaged("https://example.test/api/user/images/old.png");
	}

	@Test
	void updateImage_googleImageAsPrevious_isHandedToStorageWhichKeepsIt() {
		when(userMapper.findProfileByEmail("me@gmail.com"))
				.thenReturn(row("https://lh3.googleusercontent.com/a/abc"));
		when(storage.store(FILE)).thenReturn("https://example.test/api/user/images/new.png");

		profileImageService.updateImage("me@gmail.com", FILE);

		// 외부 URL 판별은 저장소가 한다 — 서비스는 이전 URL 을 그대로 넘기고 파일을 직접 지우지 않는다.
		verify(storage).deleteIfManaged("https://lh3.googleusercontent.com/a/abc");
	}

	@Test
	void updateImage_dbUpdateFails_deletesNewlyStoredFileAndRethrows() {
		when(userMapper.findProfileByEmail("me@gmail.com")).thenReturn(row(null));
		when(storage.store(FILE)).thenReturn("https://example.test/api/user/images/new.png");
		doThrow(new IllegalStateException("db down"))
				.when(userMapper).updateImageUrl("me@gmail.com", "https://example.test/api/user/images/new.png");

		assertThatThrownBy(() -> profileImageService.updateImage("me@gmail.com", FILE))
				.isInstanceOf(IllegalStateException.class);

		verify(storage).deleteIfManaged("https://example.test/api/user/images/new.png");
	}

	@Test
	void updateImage_unknownUser_throwsUserNotFoundWithoutStoring() {
		when(userMapper.findProfileByEmail("ghost@gmail.com")).thenReturn(null);

		assertThatThrownBy(() -> profileImageService.updateImage("ghost@gmail.com", FILE))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.USER_NOT_FOUND);

		verify(storage, never()).store(any());
	}
}
