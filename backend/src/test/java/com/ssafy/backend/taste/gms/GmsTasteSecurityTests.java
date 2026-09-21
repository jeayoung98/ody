package com.ssafy.backend.taste.gms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.InetSocketAddress;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.analysis.TasteFinding;
import com.sun.net.httpserver.HttpServer;

class GmsTasteSecurityTests {

    private static final String SECRET = "gms-secret-that-must-not-leak";
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void providerError_doesNotExposeKeyOrPayloadInApplicationException() throws Exception {
        start(exchange -> exchange.sendResponseHeaders(500, -1));

        assertThatThrownBy(() -> client(1000).generate("STANDARD", List.of(finding())))
                .isInstanceOf(GmsTasteClient.GmsTasteException.class)
                .satisfies(error -> assertThat(error.toString())
                        .doesNotContain(SECRET, "PC1 중앙 백분위", "강렬한"));
    }

    @Test
    void readTimeout_isBoundedAndRedacted() throws Exception {
        start(exchange -> {
            try {
                Thread.sleep(100);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
            exchange.sendResponseHeaders(200, -1);
        });
        long startedAt = System.nanoTime();

        assertThatThrownBy(() -> client(20).generate("STANDARD", List.of(finding())))
                .isInstanceOf(GmsTasteClient.GmsTasteException.class)
                .satisfies(error -> assertThat(error.toString()).doesNotContain(SECRET));

        long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;
        assertThat(elapsedMillis).isLessThan(1_000);
    }

    private void start(com.sun.net.httpserver.HttpHandler handler) throws Exception {
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
                SECRET, "gpt-4.1", 1000, readTimeoutMs);
    }

    private static TasteFinding finding() {
        return new TasteFinding(
                "pc1-high", "CONSISTENT_BIAS", 1, "HIGH", 30,
                "PC1 중앙 백분위 80.0, IQR 20.0", "강렬한");
    }
}
