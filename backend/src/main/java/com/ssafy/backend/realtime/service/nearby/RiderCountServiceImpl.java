package com.ssafy.backend.realtime.service.nearby;

import java.util.Collection;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.realtime.repository.redis.RideRedisRepository;

import lombok.RequiredArgsConstructor;

/** 따라오는 인원 수를 따라가기 저장소에서 읽는다. 여러 명이면 countAll 로 묶어 묻는다. */
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class RiderCountServiceImpl implements RiderCountService {

	private final RideRedisRepository rideRedisRepository;

	@Override
	public int count(String email) {
		return rideRedisRepository.riderCount(email);
	}

	@Override
	public Map<String, Integer> countAll(Collection<String> emails) {
		return rideRedisRepository.riderCountsOf(emails);
	}
}
