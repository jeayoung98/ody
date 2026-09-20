package com.ssafy.backend.realtime.dto.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 따라가기 소켓 계약 검증 (RT-33·RT-34).
 * 필드 이름이 하나만 틀려도 프론트가 조용히 못 읽으므로 JSON 키를 직접 확인한다.
 */
class RidePayloadContractTests {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	@DisplayName("RIDE_TRACK payload 의 JSON 키가 계약과 같다")
	void rideTrackPayloadKeys() throws Exception {
		RideTrackPayload payload = new RideTrackPayload(4927L, 3, -1.2542783, 1.2062433, true, 1789720100000L);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder("musicId", "layer", "x", "y", "playable", "serverTs");
	}

	@Test
	@DisplayName("RIDE_PLAYBACK payload 의 JSON 키와 값이 계약과 같다")
	void ridePlaybackPayloadKeys() throws Exception {
		RidePlaybackPayload payload = new RidePlaybackPayload(
				RidePlaybackEvent.SEEK, PlaybackState.PLAYING, 40000L, 1789719940000L);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder("event", "state", "positionMs", "serverTs");
		assertThat(objectMapper.readTree(json).get("event").asText()).isEqualTo("SEEK");
		assertThat(objectMapper.readTree(json).get("state").asText()).isEqualTo("PLAYING");
	}

	@Test
	@DisplayName("요청 본문을 계약 그대로 읽는다")
	void readsRequestBody() throws Exception {
		RidePlaybackRequest request = objectMapper.readValue(
				"{\"event\":\"SEEK\",\"positionMs\":40000}", RidePlaybackRequest.class);

		assertThat(request.event()).isEqualTo(RidePlaybackEvent.SEEK);
		assertThat(request.positionMs()).isEqualTo(40000L);
	}

	@Test
	@DisplayName("모르는 event 값은 역직렬화에서 터지지 않고 검증에서 걸린다")
	void unknownEventFailsAtValidationNotDeserialization() throws Exception {
		RidePlaybackRequest request = objectMapper.readValue(
				"{\"event\":\"REWIND\",\"positionMs\":0}", RidePlaybackRequest.class);

		assertThat(request.event()).isNull();
		assertThatThrownBy(request::validate).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("재생 위치가 음수면 거부한다")
	void rejectsNegativePosition() {
		RidePlaybackRequest request = new RidePlaybackRequest(RidePlaybackEvent.PLAY, -1L);

		assertThatThrownBy(request::validate).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("재생 위치가 없으면 거부한다")
	void rejectsNullPosition() {
		RidePlaybackRequest request = new RidePlaybackRequest(RidePlaybackEvent.PLAY, null);

		assertThatThrownBy(request::validate).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("이벤트 종류 네 가지가 계약 그대로다")
	void eventValuesMatchContract() {
		assertThat(RidePlaybackEvent.values())
				.extracting(Enum::name)
				.containsExactly("PLAY", "PAUSE", "SEEK", "DRIFT");
	}
}
