package com.ssafy.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import com.ssafy.backend.common.ApiResponse;
import com.ssafy.backend.test.controller.HelloController;
import org.junit.jupiter.api.Test;

class HelloControllerTests {

	private final HelloController controller = new HelloController();

	@Test
	void returnsHelloMessage() {
		assertEquals(ApiResponse.success(Map.of("message", "hello")), controller.hello());
	}
}
