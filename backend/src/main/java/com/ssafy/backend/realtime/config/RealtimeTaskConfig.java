package com.ssafy.backend.realtime.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 실시간 만료 정리와 비동기 기록 작업을 켠다. */
@Configuration
@EnableScheduling
@EnableAsync
public class RealtimeTaskConfig {
}
