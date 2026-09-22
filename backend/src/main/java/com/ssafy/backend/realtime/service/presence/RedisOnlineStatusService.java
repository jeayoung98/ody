package com.ssafy.backend.realtime.service.presence;

import java.util.Collection;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.presence.OnlineStatusService;
import com.ssafy.backend.realtime.repository.redis.PresenceRedisRepository;

import lombok.RequiredArgsConstructor;

/**
 * 접속 정보가 남아 있으면 접속 중으로 본다.
 *
 * 접속 정보는 소켓이 붙을 때 만들어지고 15초마다 오는 신호로 수명이 갱신된다. 45초 동안
 * 신호가 없으면 스스로 사라지므로, 창을 닫은 사람은 늦어도 45초 뒤에는 접속 안 함이 된다.
 *
 * 실시간 기능을 켜지 않은 사람은 접속해 있어도 접속 안 함으로 나온다. 지도에도 안 보이는
 * 사람이라 화면 전체로 보면 앞뒤가 맞는다.
 */
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class RedisOnlineStatusService implements OnlineStatusService {

	private final PresenceRedisRepository presenceRedisRepository;

	@Override
	public boolean isOnline(String email) {
		return presenceRedisRepository.isConnected(email);
	}

	@Override
	public Map<String, Boolean> onlineOf(Collection<String> emails) {
		return presenceRedisRepository.connectedOf(emails);
	}
}
