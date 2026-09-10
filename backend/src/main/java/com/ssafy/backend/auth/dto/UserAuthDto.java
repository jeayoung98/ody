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
}
