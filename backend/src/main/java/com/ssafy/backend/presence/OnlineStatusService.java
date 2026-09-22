package com.ssafy.backend.presence;

import java.util.Collection;
import java.util.Map;

/**
 * 그 사람이 지금 접속해 있는지.
 *
 * 접속이란 소켓이 살아 있다는 뜻이다. 서버는 이 값을 이미 정확히 알고 있어서,
 * 화면에서 마지막 활동 시각으로 짐작할 이유가 없다 — 그 값은 로그인 시각이라 접속과 상관없다.
 *
 * 사용자 상세와 팔로우 목록이 쓴다. 두 곳 다 실시간 기능과 상관없이 떠야 해서
 * 실제 구현을 직접 부르지 않고 이 인터페이스를 거친다. 실시간을 켜지 않은 구성에서는
 * 늘 접속 안 함으로 답하는 구현이 대신 뜬다.
 */
public interface OnlineStatusService {

	/**
	 * 한 명이 지금 접속해 있는지.
	 *
	 * @param email 확인할 사람
	 * @return 소켓이 살아 있으면 true
	 */
	boolean isOnline(String email);

	/**
	 * 여러 명을 한 번에 확인한다.
	 *
	 * 목록 화면이 쓴다. 한 명씩 물으면 목록에 오르는 사람 수만큼 왕복이 생겨 그대로 지연이 된다.
	 *
	 * @param emails 확인할 사람들
	 * @return 접속해 있는 사람만 담긴다. 없는 사람은 아예 빠지므로 꺼낼 때 기본값을 줘야 한다
	 */
	Map<String, Boolean> onlineOf(Collection<String> emails);
}
