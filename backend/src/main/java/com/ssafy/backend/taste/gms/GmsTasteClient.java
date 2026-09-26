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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.taste.analysis.TasteFinding;

@Component
public class GmsTasteClient {

    private static final String INSTRUCTIONS = """
            제공된 finding 만 근거로 한국어 음악 취향 문장을 작성하세요.
            읽는 사람은 자기 취향을 보는 본인입니다. 모든 문장을 해요체로 끝내세요.
            "~합니다", "~이다" 로 끝내지 말고 "~해요", "~네요", "~보여요" 처럼 씁니다.
            사용자, 이 사람, 이 개인 같은 3인칭 호칭을 쓰지 마세요.

            axisPhrase 는 그 사람이 기울어 있는 쪽 그 자체입니다.
            반대쪽을 지어내 견주지 마세요. "A 보다 B", "덜", "아닌", "반대로" 는 뜻을 뒤집습니다.
            axisPhrase 에 " / " 가 있으면 한 축의 양 끝이라는 뜻입니다.
            이때는 두 표현을 모두 그대로 쓰되 " / " 는 자연스러운 우리말로 이으세요.

            숫자를 문장에 쓰지 마세요. evidence 는 근거일 뿐 문장에 옮기지 않습니다.
            장르, 가수, 곡 제목, 감정, 성격도 언급하지 마세요.

            summary 는 한 문장입니다. finding 을 축별로 나열하지 말고 하나의 취향으로 엮으세요.
            제공된 axisPhrase 중 하나 이상을 그대로 포함하고 160자를 넘지 마세요.

            각 narrative 는 finding 하나를 설명하며 그 finding 의 axisPhrase 를 그대로 포함해야 합니다.
            type 이 CONSISTENT_BIAS 면 그쪽으로 꾸준히, BIAS 면 그쪽으로 기울었지만 폭도 함께,
            DIVERSE 면 양 끝을 폭넓게 듣는다는 뜻입니다.

            표본이 적다는 안내는 화면이 배지로 따로 합니다. 문장에 "잠정", "아직" 같은 단서를 붙이지 마세요.
            narratives 는 findingId 와 정확히 대응해야 합니다.
            """;

    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String key;
    private final String model;
    /**
     * {@code Map} 으로 들고 있는다. {@code JsonNode}(Jackson 2) 를 요청 Map 에 넣으면 RestClient 의
     * Jackson 3 가 트리로 알아보지 못하고 게터를 펼쳐 {@code {"array":false,...,"nodeType":"OBJECT"}} 가
     * 스키마 자리에 나간다 — strict json_schema 가 400 을 내고 모든 리포트가 FALLBACK 이 됐다 (S15P21A405-648).
     */
    private final Map<String, Object> outputSchema;

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
        String normalizedBaseUrl = normalizeBaseUrl(baseUrl);
        this.restClient = RestClient.builder().baseUrl(normalizedBaseUrl).requestFactory(requestFactory).build();
        this.outputSchema = readSchema(this.objectMapper);
    }

    /**
     * base URL 이 {@code /v1} 으로 끝나도록 맞춘다. 요청은 상대 경로 {@code responses} 로 보내므로
     * {@code /v1} 은 base URL 이 들고 있어야 한다.
     *
     * <p>2026-09-22 운영 {@code GMS_BASE_URL} 이 {@code .../api.openai.com} 으로 {@code /v1} 없이 들어와 있었다.
     * GMS 는 OpenAI 주소를 그대로 잇는 프록시라 {@code /v1/responses} 가 맞는 경로인데, 값에 따라
     * {@code /responses} 로 나갈 수 있어 여기서 흡수한다.
     *
     * <p>ponytail: 운영 env 를 고치는 대신 코드가 보정한다. GMS 가 경로 규칙을 바꾸면 이 보정을 걷어내고
     * env 를 정본으로 되돌린다.
     */
    static String normalizeBaseUrl(String baseUrl) {
        String trimmed = baseUrl.strip();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (!trimmed.endsWith("/v1")) {
            trimmed = trimmed + "/v1";
        }
        return trimmed + "/";
    }

    public GmsTasteOutput generate(String level, List<TasteFinding> findings, int sampleSize) {
        if (key == null || key.isBlank()) {
            throw new GmsTasteException("GMS_NOT_CONFIGURED");
        }
        Map<String, Object> safeInput = Map.of(
                "reportLevel", level,
                "sampleSize", sampleSize,
                "findings", findings.stream().map(finding -> Map.of(
                        "findingId", finding.id(),
                        "type", finding.type(),
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

    private static Map<String, Object> readSchema(ObjectMapper objectMapper) {
        try (InputStream input = GmsTasteClient.class.getResourceAsStream("/taste/taste-gms-output-v1.json")) {
            if (input == null) {
                throw new IllegalStateException("taste GMS output schema missing");
            }
            return objectMapper.readValue(input, new TypeReference<>() {
            });
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
