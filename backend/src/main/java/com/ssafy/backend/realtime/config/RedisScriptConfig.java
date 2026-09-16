package com.ssafy.backend.realtime.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scripting.support.ResourceScriptSource;

/**
 * Lua 스크립트를 DefaultRedisScript 빈으로 등록. 원자성이 필요한 연산은 전부 Lua 로 처리한다.
 * 빈 이름 = 파라미터 이름으로 주입받는다(타입 소거로 이름 매칭 필요).
 * 골격 단계: 스크립트 파일은 스텁(return {}). 실제 로직은 내부작업(R-04).
 */
@Configuration
public class RedisScriptConfig {

	/** 배치·이사 원자 — join(활성 배치). 반환: {'OK'}/{'STALE'}. 만남 없음. */
	@Bean
	public DefaultRedisScript<List> presenceJoinScript() {
		return listScript("redis/presence-join.lua");
	}

	/** 곡 변경 원자 갱신 — 반환: 진입 직전 신곡 청취자 목록(만남 판정용). */
	@Bean
	public DefaultRedisScript<List> presencePlayScript() {
		return listScript("redis/presence-play.lua");
	}

	/** 사용자 상태와 주변사람 구독을 함께 지우는 스크립트. */
	@Bean
	public DefaultRedisScript<List> presenceLeaveScript() {
		return listScript("redis/presence-leave.lua");
	}

	/** 셀 인원수 재검증 — 반환: 불일치 셀 수. */
	@Bean
	public DefaultRedisScript<Long> usercountRecountScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(new ClassPathResource("redis/usercount-recount.lua")));
		script.setResultType(Long.class);
		return script;
	}

	/** 주변사람 구독 곡을 새 목록으로 바꾸는 스크립트. */
	@Bean
	public DefaultRedisScript<Long> nearbySubscriptionReplaceScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(
				new ClassPathResource("redis/nearby-subscription-replace.lua")));
		script.setResultType(Long.class);
		return script;
	}

	/** 현재 접속이(현재 세션아이디일때) 요청한 주변사람 구독만 닫는 스크립트. */
	@Bean
	public DefaultRedisScript<Long> nearbySubscriptionCloseScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(
				new ClassPathResource("redis/nearby-subscription-close.lua")));
		script.setResultType(Long.class);
		return script;
	}

	private DefaultRedisScript<List> listScript(String path) {
		DefaultRedisScript<List> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(new ClassPathResource(path)));
		script.setResultType(List.class);
		return script;
	}
}
