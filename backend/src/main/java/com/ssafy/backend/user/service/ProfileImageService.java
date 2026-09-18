package com.ssafy.backend.user.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.ssafy.backend.common.CustomException;
import com.ssafy.backend.common.UserErrorCode;
import com.ssafy.backend.user.dto.ProfileImageUpdateResponse;
import com.ssafy.backend.user.dto.UserProfileRow;
import com.ssafy.backend.user.image.ProfileImageStorage;
import com.ssafy.backend.user.mapper.UserMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 프로필 이미지 교체 (S15P21A405-426). 토큰 주체 본인만 대상이라 email 파라미터를 받지 않는다.
 *
 * 순서가 중요하다 — 새 파일을 먼저 쓰고, DB 갱신이 실패하면 방금 쓴 파일을 지워 되돌린다. 이전 파일 삭제는
 * DB 갱신이 확정된 뒤에만 한다. 이 순서라면 실패해도 DB 가 가리키는 파일은 항상 존재한다.
 *
 * 이전 파일 삭제는 이 저장소가 만든 파일일 때만 일어난다. 구글 프로필 사진(외부 URL)은 삭제 대상이 아니고,
 * 삭제에 실패해도 고아 파일이 남을 뿐이라 요청은 성공으로 응답한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileImageService {

	private final UserMapper userMapper;
	private final ProfileImageStorage profileImageStorage;

	public ProfileImageUpdateResponse updateImage(String email, MultipartFile file) {
		UserProfileRow current = userMapper.findProfileByEmail(email);
		if (current == null) {
			throw new CustomException(UserErrorCode.USER_NOT_FOUND);
		}

		String previousImageUrl = current.getImageUrl();
		String newImageUrl = profileImageStorage.store(file);

		try {
			userMapper.updateImageUrl(email, newImageUrl);
		} catch (RuntimeException e) {
			profileImageStorage.deleteIfManaged(newImageUrl);
			throw e;
		}

		profileImageStorage.deleteIfManaged(previousImageUrl);

		log.info("[User] 프로필 이미지 수정 완료 email={}", email);
		return new ProfileImageUpdateResponse(newImageUrl);
	}
}
