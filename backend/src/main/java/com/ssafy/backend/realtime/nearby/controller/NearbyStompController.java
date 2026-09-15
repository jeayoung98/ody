package com.ssafy.backend.realtime.nearby.controller;

import java.security.Principal;

import org.springframework.context.annotation.Profile;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import com.ssafy.backend.realtime.nearby.service.NearbyPeopleService;

import lombok.RequiredArgsConstructor;

/** 주변사람 패널의 소켓 요청을 받는다. */
@Controller
@Profile("realtime")
@RequiredArgsConstructor
public class NearbyStompController {

	private final NearbyPeopleService nearbyPeopleService; // 주변사람 구독 관리

	/**
	 * 패널을 닫은 사용자의 주변사람 구독을 해제한다.
	 *
	 * @param principal 로그인한 사용자
	 */
	@MessageMapping("/nearby/close")
	public void close(Principal principal) {
		nearbyPeopleService.close(principal.getName());
	}
}
