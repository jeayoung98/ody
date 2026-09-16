package com.ssafy.backend.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan({"com.ssafy.backend.*.mapper", "com.ssafy.backend.realtime.repository.mapper"})
public class MyBatisConfig {
}
