package com.ssafy.backend.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan("com.ssafy.backend.*.mapper")
public class MyBatisConfig {
}
