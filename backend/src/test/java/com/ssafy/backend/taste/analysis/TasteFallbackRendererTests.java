package com.ssafy.backend.taste.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class TasteFallbackRendererTests {

    private final TasteFallbackRenderer renderer = new TasteFallbackRenderer();

    @Test
    void initialReport_leavesTentativeWordingToTheScreen() {
        TasteFinding finding = new TasteFinding(
                "pc1-high", "BIAS", 1, "HIGH", 20, "근거", "강렬한");

        TasteFallbackRenderer.RenderedReport report = renderer.render("INITIAL", List.of(finding));

        // 잠정 안내는 문장이 아니라 report.level 배지로 간다 [S15P21A405-634].
        // spec 009 FR-013·SC-008 은 아직 문장 안 안내를 요구한다 — 기획 확인 대기.
        assertThat(report.summary()).doesNotContain("잠정");
        assertThat(report.summary()).startsWith("강렬한");
        assertThat(report.narratives()).singleElement()
                .extracting(narrative -> narrative.findingId())
                .isEqualTo("pc1-high");
    }
}
