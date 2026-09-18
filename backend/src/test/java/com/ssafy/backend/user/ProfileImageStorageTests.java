package com.ssafy.backend.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.image.ProfileImageStorage;

/**
 * 프로필 이미지 저장소 유닛 (S15P21A405-426). 확장자는 클라이언트가 보낸 Content-Type 이 아니라
 * 실제 바이트로 정해지고, 삭제는 이 저장소가 만든 파일에만 일어난다.
 */
class ProfileImageStorageTests {

	private static final String BASE_URL = "https://example.test/api/user/images";

	@TempDir
	Path tempDir;

	private ProfileImageStorage storage;

	@BeforeEach
	void setUp() {
		storage = new ProfileImageStorage(tempDir.toString(), BASE_URL);
	}

	private static byte[] png() {
		byte[] bytes = new byte[32];
		byte[] signature = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };
		System.arraycopy(signature, 0, bytes, 0, signature.length);
		return bytes;
	}

	private static byte[] jpeg() {
		byte[] bytes = new byte[32];
		bytes[0] = (byte) 0xFF;
		bytes[1] = (byte) 0xD8;
		bytes[2] = (byte) 0xFF;
		return bytes;
	}

	private static byte[] webp() {
		byte[] bytes = new byte[32];
		System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, bytes, 0, 4);
		System.arraycopy("WEBP".getBytes(StandardCharsets.US_ASCII), 0, bytes, 8, 4);
		return bytes;
	}

	@Test
	void store_png_writesUuidNamedFileAndReturnsPublicUrl() throws IOException {
		String url = storage.store(new MockMultipartFile("file", "avatar.png", "image/png", png()));

		assertThat(url).startsWith(BASE_URL + "/").endsWith(".png");
		String storedName = url.substring((BASE_URL + "/").length());
		assertThat(storedName).matches("[0-9a-f]{32}\\.png");
		assertThat(Files.exists(tempDir.resolve(storedName))).isTrue();
	}

	@Test
	void store_jpegAndWebp_areAccepted() {
		assertThat(storage.store(new MockMultipartFile("file", "a.jpg", "image/jpeg", jpeg()))).endsWith(".jpg");
		assertThat(storage.store(new MockMultipartFile("file", "a.webp", "image/webp", webp()))).endsWith(".webp");
	}

	@Test
	void store_twice_producesDistinctFiles() throws IOException {
		String first = storage.store(new MockMultipartFile("file", "a.png", "image/png", png()));
		String second = storage.store(new MockMultipartFile("file", "a.png", "image/png", png()));

		assertThat(first).isNotEqualTo(second);
		try (var files = Files.list(tempDir)) {
			assertThat(files).hasSize(2);
		}
	}

	@Test
	void store_nonImageBytes_throwsInvalidImageFile() {
		byte[] notAnImage = "<?php echo 1; ?>".getBytes(StandardCharsets.UTF_8);

		assertThatThrownBy(() -> storage.store(
				new MockMultipartFile("file", "evil.png", "image/png", notAnImage)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.INVALID_IMAGE_FILE);
	}

	@Test
	void store_emptyFile_throwsInvalidImageFile() {
		assertThatThrownBy(() -> storage.store(
				new MockMultipartFile("file", "a.png", "image/png", new byte[0])))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.INVALID_IMAGE_FILE);
	}

	@Test
	void store_oversizedFile_throwsImageFileTooLarge() {
		byte[] tooBig = new byte[(int) ProfileImageStorage.MAX_BYTES + 1];
		byte[] signature = png();
		System.arraycopy(signature, 0, tooBig, 0, 8);

		assertThatThrownBy(() -> storage.store(
				new MockMultipartFile("file", "big.png", "image/png", tooBig)))
				.isInstanceOf(CustomException.class)
				.extracting(e -> ((CustomException) e).getErrorCode())
				.isEqualTo(UserErrorCode.IMAGE_FILE_TOO_LARGE);
	}

	@Test
	void deleteIfManaged_ownFile_deletesIt() {
		String url = storage.store(new MockMultipartFile("file", "a.png", "image/png", png()));
		String storedName = url.substring((BASE_URL + "/").length());

		assertThat(storage.deleteIfManaged(url)).isTrue();
		assertThat(Files.exists(tempDir.resolve(storedName))).isFalse();
	}

	@Test
	void deleteIfManaged_googleUrl_doesNothing() {
		assertThat(storage.deleteIfManaged("https://lh3.googleusercontent.com/a/abc123")).isFalse();
	}

	@Test
	void deleteIfManaged_null_doesNothing() {
		assertThat(storage.deleteIfManaged(null)).isFalse();
	}

	@Test
	void deleteIfManaged_pathTraversalAttempt_doesNothing() throws IOException {
		Path outside = tempDir.getParent().resolve("keep-me.txt");
		Files.writeString(outside, "keep");

		assertThat(storage.deleteIfManaged(BASE_URL + "/../keep-me.txt")).isFalse();
		assertThat(Files.exists(outside)).isTrue();

		Files.deleteIfExists(outside);
	}

	@Test
	void deleteIfManaged_unmanagedNameInSameDirectory_doesNothing() throws IOException {
		Files.writeString(tempDir.resolve("legacy.png"), "keep");

		assertThat(storage.deleteIfManaged(BASE_URL + "/legacy.png")).isFalse();
		assertThat(Files.exists(tempDir.resolve("legacy.png"))).isTrue();
	}
}
