package com.ssafy.backend.realtime.service.nearby;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** 따라가기 저장소가 생기기 전까지 동승자 수를 0으로 준다. 이후 이 구현만 교체한다. */
@Component
@Profile("realtime")
public class RiderCountServiceImpl implements RiderCountService {

	@Override
	public int count(String email) {
		return 0;
	}
}
