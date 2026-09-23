package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class TasteFallbackRendererTests {

    private final TasteFallbackRenderer renderer = new TasteFallbackRenderer();

    @Test
    void initialReport_alwaysContainsTentativeLanguage() {
        TasteFinding finding = new TasteFinding(
                "pc1-high", "BIAS", 1, "HIGH", 20, "근거", "강렬한");

        TasteFallbackRenderer.RenderedReport report = renderer.render("INITIAL", List.of(finding));

        assertThat(report.summary()).contains("잠정 경향");
        assertThat(report.narratives()).singleElement()
                .extracting(narrative -> narrative.findingId())
                .isEqualTo("pc1-high");
    }
}
