package com.ssafy.backend.realtime.dto.nearby;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 선단 해체 시 주변사람 알림 계약 검증.
 * 필드 이름이 하나만 틀려도 프론트가 조용히 못 읽으므로 JSON 키를 직접 확인한다.
 */
class NearbyBulkEnterContractTests {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	@DisplayName("NEARBY_BULK_ENTER 의 JSON 키가 계약과 같다")
	void bulkEnterKeys() throws Exception {
		NearbyBulkEnter payload = new NearbyBulkEnter(4927L,
				List.of(new NearbyChange("a@example.com", "A", null, 3, 2, 4927L, null, null)));

		JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(payload));

		assertThat(json.fieldNames()).toIterable().containsExactlyInAnyOrder("musicId", "people");
		assertThat(json.get("people").get(0).fieldNames()).toIterable()
				.containsExactlyInAnyOrder(
						"email", "nickname", "imageUrl", "meetingCount", "riderCount", "musicId", "x", "y");
	}

	/** 한 명씩 보내면 받는 쪽이 그 수만큼 목록을 다시 그린다. 한 덩어리여야 하는 이유다. */
	@Test
	@DisplayName("여러 사람이 한 덩어리에 담긴다")
	void manyPeopleInOneMessage() throws Exception {
		NearbyBulkEnter payload = new NearbyBulkEnter(4927L, List.of(
				new NearbyChange("a@example.com", "A", null, 0, 0, 4927L, null, null),
				new NearbyChange("b@example.com", "B", null, 1, 0, 4927L, null, null)));

		JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(payload));

		assertThat(json.get("people")).hasSize(2);
	}

	@Test
	@DisplayName("NEARBY_RIDER_COUNT 의 JSON 키가 계약과 같다")
	void riderCountKeys() throws Exception {
		NearbyRiderCount payload = new NearbyRiderCount("a@example.com", 3, 4927L);

		JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(payload));

		assertThat(json.fieldNames()).toIterable()
				.containsExactlyInAnyOrder("email", "riderCount", "musicId");
	}
}
