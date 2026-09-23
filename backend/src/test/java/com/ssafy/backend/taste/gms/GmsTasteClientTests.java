package com.ssafy.backend.taste.gms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.backend.taste.analysis.TasteFinding;
import com.sun.net.httpserver.HttpServer;

class GmsTasteClientTests {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void sendsOnlyAggregateFindingAndParsesStructuredOutput() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/responses", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            ObjectMapper mapper = new ObjectMapper();
            String structured = mapper.writeValueAsString(Map.of(
                    "summary", "강렬한 음악을 즐겨요.",
                    "narratives", List.of(Map.of(
                            "findingId", "pc1-high",
                            "text", "강렬한 쪽에 모여 있어요."))));
            String output = mapper.writeValueAsString(Map.of(
                    "id", "resp_1",
                    "output", List.of(Map.of(
                            "type", "message",
                            "content", List.of(Map.of("type", "output_text", "text", structured))))));
            exchange.sendResponseHeaders(200, output.getBytes(StandardCharsets.UTF_8).length);
            exchange.getResponseBody().write(output.getBytes(StandardCharsets.UTF_8));
            exchange.close();
        });
        server.start();
        GmsTasteClient client = new GmsTasteClient(
                "http://localhost:" + server.getAddress().getPort() + "/v1",
                "secret", "gpt-4o", 1000, 1000);

        GmsTasteOutput result = client.generate("STANDARD", List.of(finding()), 40);

        assertThat(result.responseId()).isEqualTo("resp_1");
        assertThat(authorization.get()).isEqualTo("Bearer secret");
        assertThat(requestBody.get())
                .contains("\"store\":false", "\"type\":\"json_schema\"", "pc1-high")
                .contains("sampleSize")
                .doesNotContain("email", "musicId", "title");
    }

    @Test
    void malformedResponse_isRejected() throws Exception {
        startServer(exchange -> {
            byte[] body = "not-json".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
        });

        assertThatThrownBy(() -> client(1000).generate("STANDARD", List.of(finding()), 40))
                .isInstanceOf(GmsTasteClient.GmsTasteException.class)
                .satisfies(error -> assertThat(((GmsTasteClient.GmsTasteException) error).code())
                        .isEqualTo("GMS_INVALID_OUTPUT"));
    }

    @Test
    void httpError_isClassifiedWithoutRetry() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        startServer(exchange -> {
            requests.incrementAndGet();
            exchange.sendResponseHeaders(500, -1);
        });

        assertThatThrownBy(() -> client(1000).generate("STANDARD", List.of(finding()), 40))
                .isInstanceOf(GmsTasteClient.GmsTasteException.class)
                .satisfies(error -> assertThat(((GmsTasteClient.GmsTasteException) error).code())
                        .isEqualTo("GMS_REQUEST_FAILED"));
        assertThat(requests).hasValue(1);
    }

    @Test
    void missingOutput_isRejectedAsRefusal() throws Exception {
        startServer(exchange -> {
            byte[] body = "{\"id\":\"resp_refused\",\"output\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
        });

        assertThatThrownBy(() -> client(1000).generate("STANDARD", List.of(finding()), 40))
                .isInstanceOf(GmsTasteClient.GmsTasteException.class)
                .satisfies(error -> assertThat(((GmsTasteClient.GmsTasteException) error).code())
                        .isEqualTo("GMS_NO_OUTPUT"));
    }

    @Test
    void readTimeout_isClassifiedWithoutRetry() throws Exception {
        startServer(exchange -> {
            try {
                Thread.sleep(100);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
            exchange.sendResponseHeaders(200, -1);
        });

        assertThatThrownBy(() -> client(20).generate("STANDARD", List.of(finding()), 40))
                .isInstanceOf(GmsTasteClient.GmsTasteException.class)
                .satisfies(error -> assertThat(((GmsTasteClient.GmsTasteException) error).code())
                        .isEqualTo("GMS_REQUEST_FAILED"));
    }

    @Test
    void unknownFindingId_isRejectedAfterClientParsing() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp_1", "강렬한 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("invented", "근거 없는 설명이에요.")));

        assertThatThrownBy(() -> new GmsTasteOutputValidator().validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid finding");
    }

    private void startServer(com.sun.net.httpserver.HttpHandler handler) throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/responses", exchange -> {
            try {
                handler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
    }

    private GmsTasteClient client(int readTimeoutMs) {
        return new GmsTasteClient(
                "http://localhost:" + server.getAddress().getPort() + "/v1",
                "secret", "gpt-4o", 1000, readTimeoutMs);
    }

    private static TasteFinding finding() {
        return new TasteFinding(
                "pc1-high", "CONSISTENT_BIAS", 1, "HIGH", 30,
                "PC1 중앙 백분위 80.0, IQR 20.0", "강렬한");
    }

    @Test
    void baseUrl_withoutV1_getsV1Appended() {
        assertThat(GmsTasteClient.normalizeBaseUrl("https://gms.ssafy.io/gmsapi/api.openai.com"))
                .isEqualTo("https://gms.ssafy.io/gmsapi/api.openai.com/v1/");
    }

    @Test
    void baseUrl_withV1_isNotDoubled() {
        assertThat(GmsTasteClient.normalizeBaseUrl("https://gms.ssafy.io/gmsapi/api.openai.com/v1"))
                .isEqualTo("https://gms.ssafy.io/gmsapi/api.openai.com/v1/");
        assertThat(GmsTasteClient.normalizeBaseUrl("https://gms.ssafy.io/gmsapi/api.openai.com/v1/"))
                .isEqualTo("https://gms.ssafy.io/gmsapi/api.openai.com/v1/");
    }

}
