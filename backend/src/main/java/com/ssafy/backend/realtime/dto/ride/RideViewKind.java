package com.ssafy.backend.realtime.dto.ride;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 인솔자가 지도를 보는 모양.
 *
 * 값은 프론트가 쓰는 소문자 이름 그대로 주고받는다. {@link RidePanelTab} 과 같은 이유다.
 * 프론트 `MapViewMode` 의 constellation 은 여기서 여정과 플레이리스트로 갈린다 — 받는 쪽이 조회할 API 가 다르다.
 */
public enum RideViewKind {

	/** 기본 지도. */
	DEFAULT("default"),

	/** 두 곡 사이의 여정 별자리. 시작곡·끝곡이 필요하다. */
	JOURNEY("journey"),

	/** 플레이리스트 별자리. 플레이리스트 번호가 필요하다. */
	PLAYLIST("playlist"),

	/** 한 곡 주변 탐색. 중심곡이 필요하다. */
	NEARBY("nearby");

	private final String value;

	RideViewKind(String value) {
		this.value = value;
	}

	/** 밖으로 나갈 때 쓰는 값. */
	@JsonValue
	public String value() {
		return value;
	}

	/** 모르는 값이 오면 예외 대신 null 을 준다. 검사에서 잡아 프론트에 알려주기 위해서다. */
	@JsonCreator
	public static RideViewKind from(String value) {
		for (RideViewKind kind : values()) {
			if (kind.value.equals(value)) {
				return kind;
			}
		}
		return null;
	}
}
