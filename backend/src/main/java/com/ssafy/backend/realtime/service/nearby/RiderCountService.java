package com.ssafy.backend.realtime.service.nearby;

/** 현재 이 사용자를 따라가는 인원 수를 읽는 교체점. */
public interface RiderCountService {

	int count(String email);
}
