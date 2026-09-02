package com.ssafy.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.junit.jupiter.api.Test;

class HelloControllerTests {

	private final HelloController controller = new HelloController();

	@Test
	void returnsHelloMessage() {
		assertEquals(Map.of("message", "hello"), controller.hello());
	}
}
