package com.ssafy.backend.taste.gms;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.analysis.TasteFinding;

class GmsTasteOutputValidatorTests {

    private final GmsTasteOutputValidator validator = new GmsTasteOutputValidator();

    @Test
    void rejectsUnknownFindingId() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "phrase summary", List.of(new GmsTasteOutput.Narrative("invented", "phrase text")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNarrativeThatDoesNotUseApprovedAxisPhrase() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "phrase summary",
                List.of(new GmsTasteOutput.Narrative("allowed", "unrelated text")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid finding");
    }

    @Test
    void rejectsUnsupportedGenreInference() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "phrase 록 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("allowed", "phrase 쪽에 모여 있어요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not grounded");
    }

    @Test
    void rejectsOmittedFindingNarrative() {
        GmsTasteOutput output = new GmsTasteOutput("resp", "phrase summary", List.of());

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("omitted");
    }

    private static TasteFinding finding() {
        return new TasteFinding("allowed", "BIAS", 1, "HIGH", 20, "evidence", "phrase");
    }
}
