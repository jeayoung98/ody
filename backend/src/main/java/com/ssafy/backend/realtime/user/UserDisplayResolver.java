package com.ssafy.backend.realtime.user;

import java.util.Collection;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.backend.auth.dto.UserAuthDto;
import com.ssafy.backend.auth.mapper.AuthMapper;
import com.ssafy.backend.realtime.presence.dto.UserView;

import lombok.RequiredArgsConstructor;

/**
 * email 로 그 사람의 화면 표시(닉네임·프로필 사진)를 찾아준다.
 * 근처 사람 목록엔 사람이 여러 명 나오는데 매번 DB를 때리면 느려서, 한 번 찾은 건 잠깐(5분) 기억해둔다.
 * 그래서 닉네임을 바꿔도 최대 5분이면 반영된다. realtime 켰을 때만 뜬다.
 */
@Component
@Profile("realtime")
@RequiredArgsConstructor
public class UserDisplayResolver {

	private static final long TTL_MS = 5 * 60 * 1000L; // 기억해두는 시간 5분
	private static final int MAX_ENTRIES = 10_000;     // 캐시가 너무 커지지 않게 상한

	private final AuthMapper authMapper;
	private final ConcurrentHashMap<String, Cached> cache = new ConcurrentHashMap<>();

	/** 캐시 한 칸: 값 + 언제까지 유효한지. */
	private record Cached(UserView view, long expiresAt) {
	}

	/** email 한 명 → 닉네임·프로필 사진. 없는 사람이면 둘 다 null. */
	public UserView resolve(String email) {
		long now = System.currentTimeMillis();
		Cached hit = cache.get(email);
		if (hit != null && hit.expiresAt() > now) {
			return hit.view(); // 5분 안에 찾아둔 게 있으면 그대로 씀
		}
		UserAuthDto u = authMapper.findByEmail(email);
		UserView view = (u == null) ? new UserView(null, null) : new UserView(u.getNickname(), u.getImageUrl());
		if (cache.size() < MAX_ENTRIES) {
			cache.put(email, new Cached(view, now + TTL_MS));
		}
		return view;
	}

	/** 여러 명 한꺼번에. 넣어준 순서 그대로 돌려준다. */
	public List<UserView> resolveAll(Collection<String> emails) {
		return emails.stream().map(this::resolve).toList();
	}
}
