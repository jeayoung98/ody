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
}
