package com.ssafy.backend.user.image;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * 프로필 이미지 파일 저장소 (S15P21A405-426). 저장 디렉터리와 공개 base URL 은 환경변수로 받는다
 * (PROFILE_IMAGE_DIR, PROFILE_IMAGE_BASE_URL) — 배포 호스트 경로와 서빙 주체(nginx / Spring)가
 * 코드에 박히지 않게 하기 위해서다.
 *
 * 파일명은 UUID 라서 이전 파일을 덮어쓰지 않고, 확장자는 클라이언트가 보낸 Content-Type 이 아니라
 * 실제 바이트(매직 넘버)로 판별한다. 클라이언트 헤더를 믿으면 임의 확장자로 파일을 심을 수 있다.
 */
@Slf4j
@Component
public class ProfileImageStorage {

	/** 5MB. spring.servlet.multipart.max-file-size 와 같은 값을 유지한다. */
	public static final long MAX_BYTES = 5L * 1024 * 1024;

	/** 이 저장소가 만든 파일만 지우기 위한 이름 규칙 — UUID(하이픈 제거) + 허용 확장자. */
	private static final Pattern STORED_NAME = Pattern.compile("[0-9a-f]{32}\\.(jpg|png|gif|webp)");

	private static final byte[] PNG_SIGNATURE = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A };

	private final Path directory;
	private final String baseUrl;

	public ProfileImageStorage(
			@Value("${ody.profile-image.dir}") String directory,
			@Value("${ody.profile-image.base-url}") String baseUrl) {
		this.directory = Path.of(directory).toAbsolutePath().normalize();
		this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
	}

	/**
	 * 디렉터리가 없으면 만든다. 컨테이너는 볼륨으로 마운트된 호스트 디렉터리를 쓰므로 보통 이미 존재하고,
	 * 권한이 없어 실패하면 업로드 시점이 아니라 기동 시점에 드러나야 한다.
	 */
	@PostConstruct
	void ensureDirectory() {
		try {
			Files.createDirectories(directory);
		} catch (IOException e) {
			throw new IllegalStateException("프로필 이미지 디렉터리를 만들 수 없습니다: " + directory, e);
		}
	}

	public Path getDirectory() {
		return directory;
	}

	/**
	 * 업로드 파일을 저장하고 공개 URL 을 돌려준다. 저장에 실패하면 파일을 남기지 않는다.
	 */
	public String store(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new CustomException(UserErrorCode.INVALID_IMAGE_FILE);
		}
		if (file.getSize() > MAX_BYTES) {
			throw new CustomException(UserErrorCode.IMAGE_FILE_TOO_LARGE);
		}

		byte[] bytes;
		try {
			bytes = file.getBytes();
		} catch (IOException e) {
			log.error("[User] 업로드 파일 읽기 실패", e);
			throw new CustomException(UserErrorCode.IMAGE_UPLOAD_FAILED);
		}

		String extension = detectExtension(bytes);
		if (extension == null) {
			throw new CustomException(UserErrorCode.INVALID_IMAGE_FILE);
		}

		String storedName = UUID.randomUUID().toString().replace("-", "") + "." + extension;
		Path target = directory.resolve(storedName);
		try {
			Files.createDirectories(directory);
			Files.write(target, bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
		} catch (IOException e) {
			log.error("[User] 프로필 이미지 저장 실패 path={}", target, e);
			throw new CustomException(UserErrorCode.IMAGE_UPLOAD_FAILED);
		}

		log.info("[User] 프로필 이미지 저장 완료 file={}", storedName);
		return baseUrl + "/" + storedName;
	}

	/**
	 * 이 저장소가 만든 파일일 때만 삭제한다. 구글 프로필 사진처럼 외부 URL 이거나 이름 규칙에 맞지 않으면
	 * 아무것도 하지 않고 false 를 돌려준다. 삭제 실패는 고아 파일만 남길 뿐 사용자 요청을 깨지 않으므로
	 * 로그만 남긴다.
	 */
	public boolean deleteIfManaged(String imageUrl) {
		String storedName = storedNameOf(imageUrl);
		if (storedName == null) {
			return false;
		}

		Path target = directory.resolve(storedName).normalize();
		if (!directory.equals(target.getParent())) {
			return false;
		}

		try {
			boolean deleted = Files.deleteIfExists(target);
			if (deleted) {
				log.info("[User] 이전 프로필 이미지 삭제 완료 file={}", storedName);
			}
			return deleted;
		} catch (IOException e) {
			log.warn("[User] 이전 프로필 이미지 삭제 실패 file={}", storedName, e);
			return false;
		}
	}

	private String storedNameOf(String imageUrl) {
		if (imageUrl == null) {
			return null;
		}
		String prefix = baseUrl + "/";
		if (!imageUrl.startsWith(prefix)) {
			return null;
		}
		String name = imageUrl.substring(prefix.length());
		return STORED_NAME.matcher(name).matches() ? name : null;
	}

	/**
	 * 매직 넘버로 이미지 형식을 판별한다. 지원하지 않는 형식이면 null.
	 */
	private static String detectExtension(byte[] bytes) {
		if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
			return "jpg";
		}
		if (bytes.length >= 8 && Arrays.equals(Arrays.copyOf(bytes, 8), PNG_SIGNATURE)) {
			return "png";
		}
		if (startsWith(bytes, 0, "GIF87a") || startsWith(bytes, 0, "GIF89a")) {
			return "gif";
		}
		if (startsWith(bytes, 0, "RIFF") && startsWith(bytes, 8, "WEBP")) {
			return "webp";
		}
		return null;
	}

	private static boolean startsWith(byte[] bytes, int offset, String ascii) {
		byte[] expected = ascii.getBytes(StandardCharsets.US_ASCII);
		if (bytes.length < offset + expected.length) {
			return false;
		}
		return Arrays.equals(Arrays.copyOfRange(bytes, offset, offset + expected.length), expected);
	}
}
