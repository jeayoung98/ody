package com.ssafy.backend.taste.gms;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.taste.analysis.TasteFinding;

@Component
public class GmsTasteClient {

    private static final String INSTRUCTIONS = """
            제공된 finding만 근거로 한국어 음악 취향 문장을 작성하세요.
            수치, 장르, 감정, 성격을 새로 추론하지 마세요.
            summary에는 제공된 axisPhrase 중 하나 이상을 그대로 포함하세요.
            각 narrative에는 해당 finding의 axisPhrase를 그대로 포함하세요.
            summary는 한 문장이고 narratives는 findingId와 정확히 대응해야 합니다.
            """;

    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String key;
    private final String model;
    private final JsonNode outputSchema;

    public GmsTasteClient(
            @Value("${ody.taste.gms.base-url}") String baseUrl,
            @Value("${ody.taste.gms.key}") String key,
            @Value("${ody.taste.gms.model}") String model,
            @Value("${ody.taste.gms.connect-timeout-ms}") int connectTimeoutMs,
            @Value("${ody.taste.gms.read-timeout-ms}") int readTimeoutMs) {
        this.objectMapper = new ObjectMapper().findAndRegisterModules();
        this.key = key;
        this.model = model;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        String normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        this.restClient = RestClient.builder().baseUrl(normalizedBaseUrl).requestFactory(requestFactory).build();
        this.outputSchema = readSchema(this.objectMapper);
    }

    public GmsTasteOutput generate(String level, List<TasteFinding> findings) {
        if (key == null || key.isBlank()) {
            throw new GmsTasteException("GMS_NOT_CONFIGURED");
        }
        Map<String, Object> safeInput = Map.of(
                "reportLevel", level,
                "findings", findings.stream().map(finding -> Map.of(
                        "findingId", finding.id(),
                        "type", finding.type(),
                        "direction", finding.direction(),
                        "evidence", finding.evidence(),
                        "axisPhrase", finding.axisPhrase())).toList());
        Map<String, Object> request = Map.of(
                "model", model,
                "instructions", INSTRUCTIONS,
                "input", toJson(safeInput),
                "max_output_tokens", 700,
                "store", false,
                "text", Map.of("format", Map.of(
                        "type", "json_schema",
                        "name", "taste_report",
                        "strict", true,
                        "schema", outputSchema)));
        try {
            String body = restClient.post()
                    .uri("responses")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + key)
                    .body(request)
                    .retrieve()
                    .body(String.class);
            return parse(body);
        } catch (RuntimeException error) {
            if (error instanceof GmsTasteException) {
                throw error;
            }
            throw new GmsTasteException("GMS_REQUEST_FAILED", error);
        }
    }

    public String model() {
        return model;
    }

    private GmsTasteOutput parse(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            String responseId = root.path("id").asText(null);
            for (JsonNode output : root.path("output")) {
                if (!"message".equals(output.path("type").asText())) {
                    continue;
                }
                for (JsonNode content : output.path("content")) {
                    if ("output_text".equals(content.path("type").asText())) {
                        GmsTasteOutput parsed = objectMapper.readValue(
                                content.path("text").asText(), GmsTasteOutput.class);
                        return new GmsTasteOutput(responseId, parsed.summary(), parsed.narratives());
                    }
                }
            }
            throw new GmsTasteException("GMS_NO_OUTPUT");
        } catch (IOException error) {
            throw new GmsTasteException("GMS_INVALID_OUTPUT", error);
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (IOException error) {
            throw new GmsTasteException("GMS_INPUT_SERIALIZATION_FAILED", error);
        }
    }

    private static JsonNode readSchema(ObjectMapper objectMapper) {
        try (InputStream input = GmsTasteClient.class.getResourceAsStream("/taste/taste-gms-output-v1.json")) {
            if (input == null) {
                throw new IllegalStateException("taste GMS output schema missing");
            }
            return objectMapper.readTree(input);
        } catch (IOException error) {
            throw new IllegalStateException("taste GMS output schema unreadable", error);
        }
    }

    public static class GmsTasteException extends RuntimeException {
        private final String code;

        public GmsTasteException(String code) {
            super(code);
            this.code = code;
        }

        public GmsTasteException(String code, Throwable cause) {
            super(code, cause);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }
}
