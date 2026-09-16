package com.ssafy.backend.realtime.message;

/** 사용자에게 실시간 메시지를 보내는 공통 서비스. */
public interface RealtimeMessageService {

	/** 특정 사용자의 개인 큐로 메시지를 보낸다. */
	void sendToUser(String userId, String destination, RealtimeMessageType type, Object payload);
}
