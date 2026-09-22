package com.ssafy.backend.presence;

import java.util.Collection;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * 실시간 기능을 켜지 않은 구성에서 쓰는 구현. 늘 접속 안 함으로 답한다.
 *
 * 접속 여부는 실시간이 들고 있는 값이라, 실시간이 없으면 알 방법 자체가 없다.
 * 그렇다고 사용자 상세나 팔로우 목록이 못 뜨게 하면 안 된다 — 그 화면들은 실시간과 무관하다.
 * 모른다는 뜻을 따로 두지 않고 접속 안 함으로 답하는 이유는, 받는 쪽이 할 일이 같기 때문이다.
 */
@Component
@Profile("!realtime")
public class OfflineOnlyStatusService implements OnlineStatusService {

	@Override
	public boolean isOnline(String email) {
		return false;
	}

	@Override
	public Map<String, Boolean> onlineOf(Collection<String> emails) {
		return Map.of();
	}
}
