package com.ssafy.backend.realtime.dto.viewport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 선단 해체 알림 계약 검증 (RT-39).
 * 필드 이름이 하나만 틀려도 프론트가 조용히 못 읽으므로 JSON 키를 직접 확인한다.
 */
class ViewportBulkEnterContractTests {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	@DisplayName("VIEWPORT_BULK_ENTER 의 JSON 키가 계약과 같다")
	void bulkEnterKeys() throws Exception {
		ViewportBulkEnter payload = new ViewportBulkEnter(7L, 4927L, -1.2542783, 1.2062433,
				List.of(new ViewportUser("a@example.com", "A", null, 0)));

		JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(payload));

		assertThat(json.fieldNames()).toIterable()
				.containsExactlyInAnyOrder("requestSeq", "musicId", "x", "y", "users");
		assertThat(json.get("users").get(0).fieldNames()).toIterable()
				.containsExactlyInAnyOrder("email", "nickname", "imageUrl", "riderCount");
	}

	/** 한 명씩 보내면 받는 쪽이 그 수만큼 다시 그린다. 한 덩어리여야 하는 이유다. */
	@Test
	@DisplayName("여러 사람이 한 덩어리에 담긴다")
	void manyUsersInOneMessage() throws Exception {
		ViewportBulkEnter payload = new ViewportBulkEnter(7L, 4927L, 0.0, 0.0,
				List.of(new ViewportUser("a@example.com", "A", null, 0),
						new ViewportUser("b@example.com", "B", null, 0)));

		JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(payload));

		assertThat(json.get("users")).hasSize(2);
	}

	/** 자리가 아니라 숫자만 바뀐다. 위치를 실으면 받는 쪽이 옮겨 그린다. */
	@Test
	@DisplayName("VIEWPORT_RIDER_COUNT 는 자리를 싣지 않는다")
	void riderCountKeys() throws Exception {
		ViewportRiderCount payload = new ViewportRiderCount(7L, "a@example.com", 3);

		JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(payload));

		assertThat(json.fieldNames()).toIterable()
				.containsExactlyInAnyOrder("requestSeq", "email", "riderCount");
	}
}
