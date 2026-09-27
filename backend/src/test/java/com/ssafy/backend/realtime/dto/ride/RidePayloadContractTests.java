package com.ssafy.backend.realtime.dto.ride;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 따라가기 소켓 계약 검증 (RT-33·RT-34·RT-36·RT-38).
 * 필드 이름이 하나만 틀려도 프론트가 조용히 못 읽으므로 JSON 키를 직접 확인한다.
 */
class RidePayloadContractTests {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	@DisplayName("RIDE_TRACK payload 의 JSON 키가 계약과 같다")
	void rideTrackPayloadKeys() throws Exception {
		RideTrackPayload payload = new RideTrackPayload(
				4927L, 3, -1.2542783, 1.2062433, true, 1789720100000L, 501L);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder(
						"musicId", "layer", "x", "y", "playable", "serverTs", "playHistoryId");
		assertThat(objectMapper.readTree(json).get("playHistoryId").asLong()).isEqualTo(501L);
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

	/** 대문자로 나가면 프론트가 못 읽는다. 서버가 새 이름을 만들지 않는다는 계약이다. */
	@Test
	@DisplayName("탭 값은 프론트가 쓰는 소문자 그대로 나간다")
	void tabValuesAreLowerCase() throws Exception {
		RidePanelPayload payload = RidePanelPayload.opened(4927L, RidePanelTab.INFO);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).get("tab").asText()).isEqualTo("info");
		assertThat(RidePanelTab.values())
				.extracting(RidePanelTab::value)
				.containsExactly("nearby", "info", "playlists");
	}

	@Test
	@DisplayName("RIDE_PANEL payload 의 JSON 키가 계약과 같다")
	void ridePanelPayloadKeys() throws Exception {
		RidePanelPayload payload = RidePanelPayload.opened(4927L, RidePanelTab.NEARBY);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder("open", "musicId", "tab");
	}

	@Test
	@DisplayName("닫힌 패널은 곡과 탭이 비어 나간다")
	void closedPanelHasNoMusicOrTab() throws Exception {
		String json = objectMapper.writeValueAsString(RidePanelPayload.closed());

		assertThat(objectMapper.readTree(json).get("open").asBoolean()).isFalse();
		assertThat(objectMapper.readTree(json).get("musicId").isNull()).isTrue();
		assertThat(objectMapper.readTree(json).get("tab").isNull()).isTrue();
	}

	@Test
	@DisplayName("패널 요청 본문을 계약 그대로 읽는다")
	void readsPanelRequestBody() throws Exception {
		RidePanelRequest request = objectMapper.readValue(
				"{\"open\":true,\"musicId\":4927,\"tab\":\"playlists\"}", RidePanelRequest.class);

		assertThat(request.open()).isTrue();
		assertThat(request.musicId()).isEqualTo(4927L);
		assertThat(request.tab()).isEqualTo(RidePanelTab.PLAYLISTS);
	}

	@Test
	@DisplayName("모르는 탭은 역직렬화에서 터지지 않고 검증에서 걸린다")
	void unknownTabFailsAtValidationNotDeserialization() throws Exception {
		RidePanelRequest request = objectMapper.readValue(
				"{\"open\":true,\"musicId\":4927,\"tab\":\"lyrics\"}", RidePanelRequest.class);

		assertThat(request.tab()).isNull();
		assertThatThrownBy(request::validate).isInstanceOf(IllegalArgumentException.class);
	}

	/** 닫기는 곡도 탭도 볼 필요가 없다. 그냥 닫으면 끝이다. */
	@Test
	@DisplayName("닫기 요청은 곡과 탭이 없어도 통과한다")
	void closeRequestNeedsNothingElse() {
		RidePanelRequest request = new RidePanelRequest(false, null, null);

		assertThatCode(request::validate).doesNotThrowAnyException();
	}

	@Test
	@DisplayName("열기인데 곡이 없으면 거부한다")
	void openWithoutMusicRejected() {
		RidePanelRequest request = new RidePanelRequest(true, null, RidePanelTab.INFO);

		assertThatThrownBy(request::validate).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	@DisplayName("열었는지 닫았는지가 없으면 거부한다")
	void missingOpenRejected() {
		RidePanelRequest request = new RidePanelRequest(null, 4927L, RidePanelTab.INFO);

		assertThatThrownBy(request::validate).isInstanceOf(IllegalArgumentException.class);
	}

	/** 번호를 못 받는 길이 있다. 키까지 빠지면 받는 쪽이 모양을 가늠할 수 없다. */
	@Test
	@DisplayName("재생 기록 번호가 없어도 키는 그대로 나간다")
	void rideTrackKeepsPlayHistoryIdKeyWhenEmpty() throws Exception {
		String json = objectMapper.writeValueAsString(new RideTrackPayload(
				4927L, 3, -1.2542783, 1.2062433, true, 1789720100000L, null));

		assertThat(objectMapper.readTree(json).has("playHistoryId")).isTrue();
		assertThat(objectMapper.readTree(json).get("playHistoryId").isNull()).isTrue();
	}

	@Test
	@DisplayName("RIDE_RIDER_JOINED payload 의 JSON 키가 계약과 같다")
	void rideRiderJoinedPayloadKeys() throws Exception {
		RideRiderJoinedPayload payload = new RideRiderJoinedPayload("rider@x.com", "연희", 3);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder("email", "nickname", "riderCount");
		assertThat(objectMapper.readTree(json).get("riderCount").asInt()).isEqualTo(3);
	}

	/** 이름은 비어 있을 수 있다. 키까지 빠지면 받는 쪽이 모양을 가늠할 수 없다. */
	@Test
	@DisplayName("이름이 없어도 키는 그대로 나간다")
	void joinedKeepsNicknameKeyWhenEmpty() throws Exception {
		String json = objectMapper.writeValueAsString(
				new RideRiderJoinedPayload("rider@x.com", null, 1));

		assertThat(objectMapper.readTree(json).has("nickname")).isTrue();
		assertThat(objectMapper.readTree(json).get("nickname").isNull()).isTrue();
	}

	@Test
	@DisplayName("RIDE_RIDER_LEFT payload 의 JSON 키가 계약과 같다")
	void rideRiderLeftPayloadKeys() throws Exception {
		RideRiderLeftPayload payload = new RideRiderLeftPayload("rider@x.com", 3);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder("email", "riderCount");
		assertThat(objectMapper.readTree(json).get("riderCount").asInt()).isEqualTo(3);
	}

	/** 마지막 한 명이 내리면 0 이 나가야 한다. 안 보내면 인솔자 화면에 인원수가 남는다. */
	@Test
	@DisplayName("남은 인원이 0 이어도 그대로 나간다")
	void lastRiderLeavesWithZero() throws Exception {
		String json = objectMapper.writeValueAsString(new RideRiderLeftPayload("rider@x.com", 0));

		assertThat(objectMapper.readTree(json).get("riderCount").asInt()).isZero();
	}

	@Test
	@DisplayName("RIDE_ENDED payload 의 JSON 키가 계약과 같다")
	void rideEndedPayloadKeys() throws Exception {
		RideEndedPayload payload = new RideEndedPayload(
				"captain@example.com", RideEndReason.CAPTAIN_LEFT,
				4927L, 3, -1.2542783, 1.2062433, 7, 5);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder(
						"captainEmail", "reason", "musicId", "layer", "x", "y", "cellX", "cellY");
		assertThat(objectMapper.readTree(json).get("reason").asText()).isEqualTo("CAPTAIN_LEFT");
	}

	/**
	 * 사유가 둘이 됐다. 받는 쪽이 문구를 가르는 근거가 이 글자라, 철자가 바뀌면 조용히 옛 문구가 나간다.
	 * 키가 아니라 값을 보는 이유다.
	 */
	@Test
	@DisplayName("인솔자가 스스로 끝내면 사유가 CAPTAIN_ENDED 로 나간다")
	void captainEndedReasonKeepsItsName() throws Exception {
		RideEndedPayload payload = new RideEndedPayload(
				"captain@example.com", RideEndReason.CAPTAIN_ENDED,
				4927L, 3, -1.2542783, 1.2062433, 7, 5);

		String json = objectMapper.writeValueAsString(payload);

		assertThat(objectMapper.readTree(json).get("reason").asText()).isEqualTo("CAPTAIN_ENDED");
	}

	/** 사유가 늘어도 나머지 칸은 그대로여야 한다. 받는 쪽은 두 경우에 같은 처리를 한다. */
	@Test
	@DisplayName("사유가 달라도 나머지 키는 같다")
	void bothReasonsCarryTheSameFields() throws Exception {
		RideEndedPayload left = new RideEndedPayload(
				"captain@example.com", RideEndReason.CAPTAIN_LEFT,
				4927L, 3, -1.2542783, 1.2062433, 7, 5);
		RideEndedPayload ended = new RideEndedPayload(
				"captain@example.com", RideEndReason.CAPTAIN_ENDED,
				4927L, 3, -1.2542783, 1.2062433, 7, 5);

		List<String> leftKeys = new ArrayList<>();
		objectMapper.readTree(objectMapper.writeValueAsString(left)).fieldNames().forEachRemaining(leftKeys::add);

		assertThat(objectMapper.readTree(objectMapper.writeValueAsString(ended)).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrderElementsOf(leftKeys);
	}

	/**
	 * 해체 응답의 값은 전부 내려간 사람들 이야기다. 인솔자 자신은 안 움직인다.
	 * 하차 응답과 필드 이름이 겹쳐서, 그쪽처럼 자리 값이 붙는 것을 막아 둔다.
	 */
	@Test
	@DisplayName("해체 응답의 JSON 키가 계약과 같다")
	void disbandResponseKeys() throws Exception {
		DisbandResponse response = new DisbandResponse(3, 4927L, 3);

		String json = objectMapper.writeValueAsString(response);

		assertThat(objectMapper.readTree(json).fieldNames())
				.toIterable()
				.containsExactlyInAnyOrder("riderCount", "musicId", "layer");
		assertThat(objectMapper.readTree(json).get("riderCount").asInt()).isEqualTo(3);
	}
}
