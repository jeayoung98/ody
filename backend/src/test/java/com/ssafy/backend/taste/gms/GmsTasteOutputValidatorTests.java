package com.ssafy.backend.taste.gms;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.backend.taste.analysis.TasteFinding;

class GmsTasteOutputValidatorTests {

    private final GmsTasteOutputValidator validator = new GmsTasteOutputValidator();

    @Test
    void rejectsUnknownFindingId() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 음악을 즐겨요.", List.of(new GmsTasteOutput.Narrative("invented", "phrase 텍스트예요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNarrativeThatDoesNotUseApprovedAxisPhrase() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("allowed", "관계없는 문장이에요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid finding");
    }

    @Test
    void rejectsUnsupportedGenreInference() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 록 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("allowed", "여백 있는 쪽에 모여 있어요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not grounded");
    }

    @Test
    void rejectsOmittedFindingNarrative() {
        GmsTasteOutput output = new GmsTasteOutput("resp", "여백 있는 음악을 즐겨요.", List.of());

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("omitted");
    }

    @Test
    void acceptsGroundedPoliteOutput() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("allowed", "여백 있는 쪽으로 기울어 있어요.")));

        assertThatCode(() -> validator.validate(output, List.of(finding()))).doesNotThrowAnyException();
    }

    /** 2026-09-23 실호출에서 direction=LOW 인 축을 "덜 기울어져 있다"로 뒤집어 쓴 출력이 나왔다. */
    @Test
    void rejectsNarrativeThatReversesAxisDirection() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("allowed", "여백 있는 음악에 덜 기울어 있어요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** 수치는 evidence 필드로 따로 내려간다. 문장에 옮겨 적으면 거부한다. */
    @Test
    void rejectsNarrativeThatQuotesNumbers() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 음악을 즐겨요.",
                List.of(new GmsTasteOutput.Narrative("allowed", "여백 있는 쪽이고 중앙 백분위 84.1이에요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsFormalEnding() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 음악을 선호합니다.",
                List.of(new GmsTasteOutput.Narrative("allowed", "여백 있는 쪽에 모여 있어요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(finding())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not grounded");
    }

    /** 2026-09-23 운영 GMS 실호출 출력 그대로. 회귀하면 실제 사용자가 템플릿 문구를 보게 된다. */
    @Test
    void acceptsRealGmsOutput() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "여백 있는 곡과 어두운 느낌을 가진 음악을 즐기면서 박자에는 다양하게 반응해요.",
                List.of(
                        new GmsTasteOutput.Narrative("allowed", "여백 있는 음악을 꾸준히 좋아해요."),
                        new GmsTasteOutput.Narrative(
                                "wide", "박자에는 촘촘한 것부터 성긴 것까지 다양하게 들어요.")));

        assertThatCode(() -> validator.validate(output, List.of(finding(), diverseFinding())))
                .doesNotThrowAnyException();
    }

    /** 2026-09-23 실호출: 양 끝을 자연스럽게 이은 문장이 접착된 원문과 안 맞아 거부됐다. */
    @Test
    void acceptsDiverseNarrativeThatJoinsBothPolesNaturally() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "박자가 촘촘한 곡부터 박자가 성긴 곡까지 들어요.",
                List.of(new GmsTasteOutput.Narrative(
                        "wide", "박자가 촘촘한 곡부터 박자가 성긴 곡까지 폭넓게 들어요.")));

        assertThatCode(() -> validator.validate(output, List.of(diverseFinding())))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsDiverseNarrativeThatDropsOnePole() {
        GmsTasteOutput output = new GmsTasteOutput(
                "resp", "박자가 촘촘한 곡부터 박자가 성긴 곡까지 들어요.",
                List.of(new GmsTasteOutput.Narrative("wide", "박자가 촘촘한 곡을 폭넓게 들어요.")));

        assertThatThrownBy(() -> validator.validate(output, List.of(diverseFinding())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static TasteFinding diverseFinding() {
        return new TasteFinding("wide", "DIVERSE", 9, "BOTH", 61,
                "evidence", "박자가 촘촘한" + TasteFinding.PHRASE_SEPARATOR + "박자가 성긴");
    }

    private static TasteFinding finding() {
        return new TasteFinding("allowed", "BIAS", 1, "HIGH", 20, "evidence", "여백 있는");
    }
}
