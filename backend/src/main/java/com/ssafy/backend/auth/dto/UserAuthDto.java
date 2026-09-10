package com.ssafy.backend.auth.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserAuthDto {

	private String email;
	private String name;
	private String nickname;
	private String imageUrl;

	/** bcrypt 해시. 구글 OAuth로만 가입한 계정은 null (이메일/비밀번호 로그인 불가). */
	private String passwordHash;

	/** 온보딩(지도 튜토리얼) 완료 여부. isNewUser = !tutorialCompleted (S15P21A405-122). */
	private boolean tutorialCompleted;
}
