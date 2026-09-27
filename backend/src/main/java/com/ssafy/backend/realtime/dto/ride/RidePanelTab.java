package com.ssafy.backend.realtime.dto.ride;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 곡 상세에서 보고 있는 탭.
 *
 * 값은 프론트가 쓰는 소문자 이름 그대로 주고받는다. 서버가 새 이름을 만들면 프론트가 못 읽는다.
 * Java 이름은 대문자라 그냥 두면 대문자로 나가므로, 나갈 때와 들어올 때 모두 아래에서 바꿔 준다.
 */
public enum RidePanelTab {

	/** 이 곡 주변의 다른 곡. */
	NEARBY("nearby"),

	/** 곡 정보. */
	INFO("info"),

	/** 이 곡이 담긴 재생목록. */
	PLAYLISTS("playlists");

	private final String value;

	RidePanelTab(String value) {
		this.value = value;
	}

	/** 밖으로 나갈 때 쓰는 값. */
	@JsonValue
	public String value() {
		return value;
	}

	/**
	 * 모르는 값이 오면 예외 대신 null 을 준다.
	 *
	 * 여기서 예외를 던지면 요청을 읽는 단계에서 터져 컨트롤러까지 오지 못한다.
	 * 그러면 잘못됐다고 알려줄 기회가 없어 프론트는 아무 응답도 못 받는다.
	 * null 로 흘려보내고 검사에서 잡는다.
	 */
	@JsonCreator
	public static RidePanelTab from(String value) {
		for (RidePanelTab tab : values()) {
			if (tab.value.equals(value)) {
				return tab;
			}
		}
		return null;
	}
}
