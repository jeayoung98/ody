package com.ssafy.backend.realtime.nearby.port;

/** 현재 이 사용자를 따라가는 인원 수를 읽는 교체점. */
public interface RiderCountPort {

	int count(String email);
}
