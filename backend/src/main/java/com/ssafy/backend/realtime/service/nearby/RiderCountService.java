package com.ssafy.backend.realtime.service.nearby;

import java.util.Collection;
import java.util.Map;

/** 현재 이 사용자를 따라가는 인원 수를 읽는 교체점. */
public interface RiderCountService {

	int count(String email);

	/**
	 * 사람 목록을 넘기면, 그 사람들을 따라오는 인원이 각각 몇 명인지 돌려준다.
	 * 한 명씩 읽으면 사람 수만큼 Redis 를 다녀와야 해서 한 번에 묶는다.
	 *
	 * @param emails 인원 수를 알고 싶은 사람들
	 * @return 따라오는 사람이 있는 사람만 담긴다. 없는 사람은 아예 빠진다
	 */
	Map<String, Integer> countAll(Collection<String> emails);
}
