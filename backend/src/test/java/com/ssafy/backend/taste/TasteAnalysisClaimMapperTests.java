package com.ssafy.backend.taste;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class TasteAnalysisClaimMapperTests {

    @Test
    void schema_enforcesOnePendingAnalysisPerUserWithRequiredLease() throws IOException {
        String ddl = resource("/db/taste_analysis_001_table.sql");

        assertThat(ddl)
                .contains("CREATE UNIQUE INDEX IF NOT EXISTS ux_taste_analysis_active_user")
                .contains("WHERE status = 'PENDING'")
                .contains("lease_expires_at IS NOT NULL")
                .contains("lease_expires_at > requested_at");
    }

    @Test
    void claim_retriesFailedOrExpiredRowsButNotSuccessOrActiveRows() throws IOException {
        String mapper = resource("/mapper/taste/TasteAnalysisMapper.xml");

        assertThat(mapper)
                .contains("ON CONFLICT (email, analysis_date) DO UPDATE")
                .contains("taste_analysis.status = 'FAILED'")
                .contains("taste_analysis.status = 'PENDING'")
                .contains("taste_analysis.lease_expires_at &lt;= EXCLUDED.requested_at")
                .doesNotContain("taste_analysis.status = 'SUCCESS'");
    }

    @Test
    void terminalTransitions_onlyUpdateTheClaimingAttempt() throws IOException {
        String mapper = resource("/mapper/taste/TasteAnalysisMapper.xml");

        assertThat(mapper)
                .contains("<update id=\"markSuccess\">")
                .contains("<update id=\"markFailed\">")
                .contains("AND requested_at = #{requestedAt}");
    }

    private static String resource(String path) throws IOException {
        try (var input = TasteAnalysisClaimMapperTests.class.getResourceAsStream(path)) {
            if (input == null) {
                throw new IOException("missing test resource: " + path);
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
