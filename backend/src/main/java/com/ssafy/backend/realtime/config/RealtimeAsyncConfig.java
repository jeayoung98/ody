package com.ssafy.backend.realtime.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * realtime 스케줄러(Sweep)와 @Async 기록 경로 활성화.
 * 전역에 @EnableScheduling/@EnableAsync 가 없어서 여기서 켠다(중복 활성화는 무해).
 */
@Configuration
@EnableScheduling
@EnableAsync
public class RealtimeAsyncConfig {
}
