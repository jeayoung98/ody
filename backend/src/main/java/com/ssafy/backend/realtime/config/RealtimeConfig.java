package com.ssafy.backend.realtime.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * realtime 설정 바인딩 활성화. realtime 프로파일에서만 RealtimeProperties 를 빈으로 등록한다.
 * (application-realtime.yml 이 realtime 프로파일에서만 로드되므로 프로파일과 세트로 묶는다.
 *  프로파일 미활성 boot 에서는 이 설정·CoordinateMapper 모두 로드되지 않아 컨텍스트가 그대로 뜬다.)
 */
@Configuration
@Profile("realtime")
@EnableConfigurationProperties(RealtimeProperties.class)
public class RealtimeConfig {
}
