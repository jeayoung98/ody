package com.ssafy.backend.realtime.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scripting.support.ResourceScriptSource;

/** Redis에서 실행할 Lua 파일을 Spring에 등록한다. */
@Configuration
public class RedisScriptConfig {

	/** 사용자를 선택한 곡과 셀에 등록한다. */
	@Bean
	public DefaultRedisScript<List> presenceJoinScript() {
		return listScript("redis/presence-join.lua");
	}

	/** 듣는 곡과 위치를 바꾸고 새 곡의 기존 청취자를 돌려준다. */
	@Bean
	public DefaultRedisScript<List> presencePlayScript() {
		return listScript("redis/presence-play.lua");
	}

	/** 나간 사용자의 위치와 주변사람 구독을 함께 지운다. */
	@Bean
	public DefaultRedisScript<List> presenceLeaveScript() {
		return listScript("redis/presence-leave.lua");
	}

	/** 저장된 셀 인원수를 실제 청취자 수와 다시 맞춘다. */
	@Bean
	public DefaultRedisScript<Long> usercountRecountScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(new ClassPathResource("redis/usercount-recount.lua")));
		script.setResultType(Long.class);
		return script;
	}

	/** 주변사람 패널이 지켜볼 곡 목록을 바꾼다. */
	@Bean
	public DefaultRedisScript<Long> nearbySubscriptionReplaceScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(
				new ClassPathResource("redis/nearby-subscription-replace.lua")));
		script.setResultType(Long.class);
		return script;
	}

	/** 현재 접속에서 연 주변사람 패널의 구독을 닫는다. */
	@Bean
	public DefaultRedisScript<Long> nearbySubscriptionCloseScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(
				new ClassPathResource("redis/nearby-subscription-close.lua")));
		script.setResultType(Long.class);
		return script;
	}

	/** 현재 화면에서 지켜볼 셀 목록을 바꾼다. */
	@Bean
	public DefaultRedisScript<Long> viewportSubscriptionReplaceScript() {
		DefaultRedisScript<Long> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(
				new ClassPathResource("redis/viewport-subscription-replace.lua")));
		script.setResultType(Long.class);
		return script;
	}

	/**
	 * 목록을 돌려주는 Lua 파일을 읽는다.
	 * @param path Lua 파일 경로
	 * @return 실행할 Lua 정보
	 */
	private DefaultRedisScript<List> listScript(String path) {
		DefaultRedisScript<List> script = new DefaultRedisScript<>();
		script.setScriptSource(new ResourceScriptSource(new ClassPathResource(path)));
		script.setResultType(List.class);
		return script;
	}
}
