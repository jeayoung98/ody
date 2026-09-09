package com.ssafy.backend.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import com.ssafy.backend.dto.ChatMessageDto;

@Controller
public class WebSocketTestController {

	@MessageMapping("/test/echo")
	@SendTo("/topic/test")
	public ChatMessageDto echo(ChatMessageDto message) {
		return message;
	}
}
